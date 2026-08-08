/**
 * 队伍同步 Phase - 交换初始宝可梦数据
 *
 * 2v2 合作战斗要求：双方宝可梦同时上场
 * Field positions:
 *   [0] PLAYER   = Host 的宝可梦
 *   [1] PLAYER_2 = Client 的宝可梦
 *
 * 双方 party 只包含自己的队伍。但为了让对手宝可梦出现在 field 上，
 * 需要把对手的初始宝可梦作为 Ghost 副本加入 party 的 slot 1。
 */

import { Phase } from "#app/phase";
import { globalScene } from "#app/global-scene";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";

export class CoopPartySyncPhase extends Phase {
  public readonly phaseName = "CoopPartySyncPhase";

  override start(): void {
    const lm = LanManager.getInstance();
    const coop = CoopManager.getInstance();

    if (coop.isPartySynced()) { this.end(); return; }

    // 发送我方队伍摘要
    const myParty = globalScene.getPlayerParty().map(p => ({
      speciesId: p.species.speciesId,
      level: p.level, hp: p.hp,
      stats: [...p.stats], name: p.getNameToRender(),
      formIndex: p.formIndex, gender: p.gender, shiny: p.shiny,
    }));
    lm.send({ type: "party-sync", party: myParty, sender: lm.getRole() });

    // 等待对方队伍（忽略自己发出的回弹）
    lm.on("party-sync", (partyData: any[], sender?: string) => {
      if (sender === lm.getRole()) return;
      // 注：不再用 myFirstSpecies 过滤——双方选同一御三家时会误判为回弹

      console.log("[PARTY_SYNC] 收到对手队伍, 添加 ghost 副本到 slot 1");

      const party = globalScene.getPlayerParty();
      const localRole = lm.getRole();

      for (const pd of partyData) {
        const species = globalScene.speciesDataRegistry.getSpecies(pd.speciesId);
        if (!species) continue;
        const ghost = globalScene.addPlayerPokemon(
          species, pd.level, 0, pd.formIndex, pd.gender, pd.shiny,
          0, [15, 15, 15, 15, 15, 15], 0,
        );
        ghost.hp = pd.hp;
      }

      // 重排 party: slot 0 = Host, slot 1 = Client
      const remoteStartIdx = party.length - partyData.length;
      if (localRole === "host") {
        // Host: [host_lead, ..., client_ghosts...] → [host_lead, client_ghost1, ...]
        const ghosts = party.splice(remoteStartIdx, partyData.length);
        party.splice(1, 0, ...ghosts);
      } else {
        // Client: [client_lead, ..., host_ghosts...] → [host_ghost1, client_lead, ...]
        const ghosts = party.splice(remoteStartIdx, partyData.length);
        const myLead = party.shift()!;
        party.splice(0, 0, ghosts[0]);
        party.splice(1, 0, myLead);
        if (ghosts.length > 1) party.push(...ghosts.slice(1));
      }

      console.log("[PARTY_SYNC] party:", party.map(p => p.getNameToRender()).join(", "));
      coop.setPartySynced();
      this.end();
    });

    setTimeout(() => { this.end(); }, 30000);
  }
}
