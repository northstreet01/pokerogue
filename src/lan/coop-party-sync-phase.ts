/**
 * 队伍同步 Phase - 交换初始宝可梦数据
 *
 * 2v2 合作战斗要求：双方宝可梦同时上场。
 * Field: slot 0 = Host, slot 1 = Client
 * 把对手初始宝可梦作为 Ghost 副本加入己方 party slot 1 以显示在场上。
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

    // 收集我方队伍数据
    const myParty = globalScene.getPlayerParty().map(p => ({
      speciesId: p.species.speciesId,
      level: p.level, hp: p.hp,
      stats: [...p.stats], name: p.getNameToRender(),
      formIndex: p.formIndex, gender: p.gender, shiny: p.shiny,
    }));
    console.log("[PARTY_SYNC] 我方队伍:", myParty.map(p => `${p.name}(${p.speciesId})`).join(", "));

    let resolved = false;

    // 1. 先注册监听（防竞态）
    lm.on("party-sync", (partyData: any[], sender?: string) => {
      if (sender === lm.getRole()) {
        console.log("[PARTY_SYNC] 忽略自己发出的回弹, sender:", sender);
        return;
      }
      if (resolved) return;
      if (!partyData || partyData.length === 0) {
        console.log("[PARTY_SYNC] 收到空队伍数据, 忽略");
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      console.log("[PARTY_SYNC] 收到对手队伍:", partyData.map((p: any) => `${p.name}(${p.speciesId})`).join(", "));

      const party = globalScene.getPlayerParty();
      const localRole = lm.getRole();

      // 添加 ghost 副本
      for (const pd of partyData) {
        const species = speciesDataRegistry.getSpecies(pd.speciesId);
        if (!species) {
          console.log("[PARTY_SYNC] 未知物种:", pd.speciesId);
          continue;
        }
        const ghost = globalScene.addPlayerPokemon(
          species, pd.level, 0, pd.formIndex, pd.gender, pd.shiny,
          0, [15, 15, 15, 15, 15, 15], 0,
        );
        ghost.hp = pd.hp;
        console.log("[PARTY_SYNC] 添加 ghost:", pd.name);
      }

      // 重排 party: slot 0 = Host, slot 1 = Client
      const remoteStartIdx = party.length - partyData.length;
      console.log("[PARTY_SYNC] 重排前 party:", party.map(p => p.getNameToRender()).join(", "), "remoteStart:", remoteStartIdx);

      if (localRole === "host") {
        const ghosts = party.splice(remoteStartIdx, partyData.length);
        party.splice(1, 0, ...ghosts);
      } else {
        const ghosts = party.splice(remoteStartIdx, partyData.length);
        const myLead = party.shift()!;
        party.splice(0, 0, ghosts[0]);
        party.splice(1, 0, myLead);
        if (ghosts.length > 1) party.push(...ghosts.slice(1));
      }

      console.log("[PARTY_SYNC] 重排后 party:", party.map(p => p.getNameToRender()).join(", "));
      console.log("[PARTY_SYNC] party size:", party.length, "slot0:", party[0]?.getNameToRender(), "slot1:", party[1]?.getNameToRender());

      coop.setPartySynced();
      this.end();
    });

    // 2. 检查缓存（防竞态：消息在注册前就到了）
    const pending = lm.getPendingPartySync?.();
    if (pending && !resolved) {
      console.log("[PARTY_SYNC] 使用缓存的对手数据");
      // 直接触发 handler 逻辑（pending 是 { party, sender }）
      const listeners = (lm as any).listeners?.["party-sync"];
      // 稍后通过正常事件触发
    }

    // 3. 发送我方队伍
    lm.send({ type: "party-sync", party: myParty, sender: lm.getRole() });
    console.log("[PARTY_SYNC] 已发送我方队伍");

    // 4. 超时
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log("[PARTY_SYNC] 30s超时, 未收到对手队伍!");
        this.end();
      }
    }, 30000);
  }
}
