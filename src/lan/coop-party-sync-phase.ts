/**
 * 队伍同步 Phase - 交换初始宝可梦数据
 *
 * 2v2 合作战斗：双方宝可梦同时上场。Field: slot0=Host, slot1=Client。
 * 把对手初始宝可梦作为 Ghost 副本加入己方 party slot1 以显示在场上。
 */

import { Phase } from "#app/phase";
import { globalScene } from "#app/global-scene";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";

export class CoopPartySyncPhase extends Phase {
  public readonly phaseName = "CoopPartySyncPhase";

  override start(): void {
    const lm = LanManager.getInstance();
    const coop = CoopManager.getInstance();

    console.log("[PARTY_SYNC] start, partySynced:", coop.isPartySynced(), "role:", lm.getRole());
    if (coop.isPartySynced()) { this.end(); return; }

    const myParty = globalScene.getPlayerParty().map(p => ({
      speciesId: p.species.speciesId,
      level: p.level, hp: p.hp, maxHp: p.getMaxHp(),
      stats: [...p.stats], ivs: p.ivs ? [...p.ivs] : [15,15,15,15,15,15],
      name: p.getNameToRender(), formIndex: p.formIndex,
      gender: p.gender, shiny: p.shiny, nature: p.nature,
      abilityIndex: p.abilityIndex,
      moveset: p.getMoveset().map(m => ({ moveId: m.moveId, ppUsed: m.ppUsed, maxPp: m.getMovePp() })),
    }));
    console.log("[PARTY_SYNC] 我方队伍:", myParty.map(p => `${p.name}(${p.speciesId})`).join(", "));

    let resolved = false;

    const processPartySync = (partyData: any[], sender: string) => {
      if (sender === lm.getRole()) {
        console.log("[PARTY_SYNC] 忽略自己发出的回弹");
        return;
      }
      if (resolved) return;
      if (!partyData || partyData.length === 0) {
        console.log("[PARTY_SYNC] 收到空队伍数据");
        return;
      }
      resolved = true;
      clearTimeout(timeout);

      console.log("[PARTY_SYNC] 收到对手队伍:", partyData.map((p: any) => `${p.name}(${p.speciesId})`).join(", "));

      const party = globalScene.getPlayerParty();
      const localRole = lm.getRole();

      // 只添加对方首发 ghost。如果己方 party 已满（6只），skip——不污染背包。
      const ghostStartIdx = party.length;
      if (party.length >= 6) {
        console.log("[PARTY_SYNC] 己方队伍已满(6只), 跳过 ghost 添加");
      } else {
        const lead = partyData[0];
        const species = speciesDataRegistry.getSpecies(lead.speciesId);
        if (species) {
          const ghost = globalScene.addPlayerPokemon(
            species, lead.level, lead.abilityIndex ?? 0, lead.formIndex,
            lead.gender, lead.shiny, 0, lead.ivs ?? [15,15,15,15,15,15],
            lead.nature ?? 0,
          );
          ghost.hp = Math.min(lead.hp, lead.maxHp ?? lead.hp);
          // 设置技能（精确副本）
          if (lead.moveset) {
            ghost.tryPopulateMoveset(lead.moveset, true);
          }
          (ghost as any)._coopGhost = true;
          party.push(ghost);
          CoopManager.getInstance().setRemoteGhostIndex(party.length - 1);
          console.log("[PARTY_SYNC] 添加 ghost:", lead.name, "moves:", lead.moveset?.length);
        }
      }

      console.log("[PARTY_SYNC] 重排前:", party.map(p => p.getNameToRender()).join(", "), "ghostStart:", ghostStartIdx);

      if (localRole === "host") {
        // Host: [host_lead, host_2nd..., ghost] → [host_lead, ghost, host_2nd...]
        const ghost = party.splice(ghostStartIdx, 1)[0];
        party.splice(1, 0, ghost);
      } else {
        // Client: [client_lead, client_2nd..., ghost] → [ghost, client_lead, client_2nd...]
        const ghost = party.splice(ghostStartIdx, 1)[0];
        const myLead = party.shift()!;
        party.splice(0, 0, ghost);
        party.splice(1, 0, myLead);
      }

      console.log("[PARTY_SYNC] 重排后:", party.map(p => p.getNameToRender()).join(", "));
      console.log("[PARTY_SYNC] slot0:", party[0]?.getNameToRender(), "slot1:", party[1]?.getNameToRender());

      coop.setPartySynced();
      this.end();
    };

    // 1. 先发送我方队伍（必须在缓存检查之前！确保对方能收到）
    lm.send({ type: "party-sync", party: myParty, sender: lm.getRole() });
    console.log("[PARTY_SYNC] 已发送我方队伍");

    // 2. 超时（在缓存检查前声明，processPartySync 会 clearTimeout）
    const timeout = setTimeout(() => {
      if (!resolved) { console.log("[PARTY_SYNC] 30s超时!"); this.end(); }
    }, 30000);

    // 3. 检查缓存（防竞态：对方消息在 Phase 启动前就到了）
    const cached = lm.getPendingPartySync();
    if (cached && cached.sender !== lm.getRole()) {
      console.log("[PARTY_SYNC] 使用缓存的对手队伍（Phase启动前到达）");
      processPartySync(cached.party, cached.sender);
      return;
    }

    // 4. 注册监听（缓存未命中时走网络等待）
    lm.on("party-sync", (partyData: any[], sender?: string) => {
      processPartySync(partyData, sender!);
    });
  }
}
