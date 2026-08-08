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
      level: p.level, hp: p.hp,
      stats: [...p.stats], name: p.getNameToRender(),
      formIndex: p.formIndex, gender: p.gender, shiny: p.shiny,
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
          const ghost = globalScene.addPlayerPokemon(species, lead.level, 0, lead.formIndex, lead.gender, lead.shiny, 0, [15, 15, 15, 15, 15, 15], 0);
          ghost.hp = lead.hp;
          (ghost as any)._coopGhost = true; // 标记为 ghost，UI 层可据此过滤
          party.push(ghost);
          CoopManager.getInstance().setRemoteGhostIndex(party.length - 1);
          console.log("[PARTY_SYNC] 添加 ghost:", lead.name);
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

    // 1. 检查缓存（防竞态：对方消息在 Phase 启动前就到了）
    const cached = lm.getPendingPartySync();
    if (cached && cached.sender !== lm.getRole()) {
      console.log("[PARTY_SYNC] 使用缓存的对手队伍（Phase启动前到达）");
      processPartySync(cached.party, cached.sender);
      return;
    }

    // 2. 注册监听（必须在 send 之前）
    lm.on("party-sync", (partyData: any[], sender?: string) => {
      processPartySync(partyData, sender!);
    });

    // 3. 发送我方队伍
    lm.send({ type: "party-sync", party: myParty, sender: lm.getRole() });
    console.log("[PARTY_SYNC] 已发送我方队伍");

    // 4. 超时
    const timeout = setTimeout(() => {
      if (!resolved) { console.log("[PARTY_SYNC] 30s超时!"); this.end(); }
    }, 30000);
  }
}
