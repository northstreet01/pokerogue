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
      moveset: p.getMoveset().map(m => m.moveId),
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

      // 添加对手全部精灵作为 ghost 池（支持换人）
      const ghostStartIdx = party.length;
      let added = 0;
      for (const pd of partyData) {
        if (party.length >= 6) { console.log("[PARTY_SYNC] 队伍已满, 停止添加 ghost"); break; }
        const species = speciesDataRegistry.getSpecies(pd.speciesId);
        if (!species) continue;
        const ghost = globalScene.addPlayerPokemon(
          species, pd.level, pd.abilityIndex ?? 0, pd.formIndex,
          pd.gender, pd.shiny, 0, pd.ivs ?? [15,15,15,15,15,15],
          pd.nature ?? 0,
        );
        ghost.hp = Math.min(pd.hp, pd.maxHp ?? pd.hp);
        if (pd.moveset?.length > 0) ghost.tryPopulateMoveset(pd.moveset, true);
        (ghost as any)._coopGhost = true;
        party.push(ghost);
        added++;
      }
      CoopManager.getInstance().setRemotePartyRange(ghostStartIdx, party.length - ghostStartIdx);
      console.log("[PARTY_SYNC] 添加", added, "只 ghost, 起始位置:", ghostStartIdx);

      console.log("[PARTY_SYNC] 重排前:", party.map(p => p.getNameToRender()).join(", "), "ghostStart:", ghostStartIdx);

      // ghost 全部留在 party 末尾，不混入本地精灵
      // getPlayerField() 负责把正确的 ghost 映射到 field slot

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
