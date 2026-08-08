/**
 * 队伍同步 Phase - 交换初始宝可梦数据
 *
 * 合作模式同屏战斗要求：双方宝可梦同时上场
 * Field positions:
 *   [0] PLAYER   = Host 的宝可梦 (Host 操控 / Client 看 Ghost)
 *   [1] PLAYER_2 = Client 的宝可梦 (Host 等待指令 / Client 操控)
 *
 * Party 重排规则：getPlayerField() 返回 party[0] 和 party[1]
 * 所以双方 party 必须统一为: [Host的, Client的, 本地剩余...]
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

    console.log("[PARTY_SYNC] start, partySynced:", coop.isPartySynced(), "role:", lm.getRole());

    if (coop.isPartySynced()) { this.end(); return; }

    // 发送我方队伍
    const myParty = globalScene.getPlayerParty().map(p => ({
      speciesId: p.species.speciesId,
      level: p.level, hp: p.hp,
      stats: [...p.stats], name: p.getNameToRender(),
      formIndex: p.formIndex, gender: p.gender, shiny: p.shiny,
    }));
    const myFirstSpecies = myParty[0]?.speciesId;
    lm.send({ type: "party-sync", party: myParty, sender: lm.getRole() });

    // 等待对方队伍（忽略自己发出的）
    lm.on("party-sync", (partyData: any[], sender?: string) => {
      // 忽略自己发出的消息（Socket.io 广播会回弹）
      if (sender === lm.getRole()) return;
      // 忽略和自己的第一只宝可梦相同的（双重保险）
      if (partyData[0]?.speciesId === myFirstSpecies) return;

      console.log("[PARTY_SYNC] 收到对手队伍, size:", partyData.length);

      const party = globalScene.getPlayerParty();

      for (const pd of partyData) {
        const species = globalScene.speciesDataRegistry.getSpecies(pd.speciesId);
        if (!species) continue;
        const rp = globalScene.addPlayerPokemon(
          species, pd.level, 0, pd.formIndex, pd.gender, pd.shiny,
          0, [15, 15, 15, 15, 15, 15], 0,
        );
        rp.hp = pd.hp;
        console.log("[PARTY_SYNC] 添加对手宝可梦:", pd.name, "species:", pd.speciesId);
      }

      // === 关键：重排 party 以适配同屏双打 ===
      // getPlayerField() 取 party[0] 和 party[1] 映射到场上的 PLAYER(0) 和 PLAYER_2(1)
      // 统一约定: 位置 0 = Host 的宝可梦, 位置 1 = Client 的宝可梦
      // Host 端: party = [Host的, Host备用..., Client的...]
      //   → 需要重排为 [Host的, Client的, Host备用...]
      // Client 端: party = [Client的, Client备用..., Host的...]
      //   → 需要重排为 [Host的, Client的, Client备用...]
      const localRole = lm.getRole();
      const remoteStartIdx = party.length - partyData.length; // 对手宝可梦起始位置

      if (localRole === "host") {
        // Host: party[0] = Host自己的, party[1] 应为 Client的第一个
        const clientMons = party.splice(remoteStartIdx, partyData.length);
        party.splice(1, 0, ...clientMons);
        console.log("[PARTY_SYNC] Host 重排: [0]=Host, [1]=Client, rest...");
      } else {
        // Client: party[0] = Client自己的, party[1..] = Host的
        // 需要: party[0] = Host的第一个, party[1] = Client自己的
        const hostMons = party.splice(remoteStartIdx, partyData.length);
        // 把 Client 自己的挪到位置 1，Host 的放位置 0
        const clientSelf = party.shift()!;       // 取出 Client 的第一只
        party.splice(0, 0, hostMons[0]);           // 位置 0 = Host
        party.splice(1, 0, clientSelf);            // 位置 1 = Client
        // 剩余 hostMons[1..] 追加到末尾
        if (hostMons.length > 1) {
          party.push(...hostMons.slice(1));
        }
        console.log("[PARTY_SYNC] Client 重排: [0]=Host, [1]=Client, rest...");
      }

      console.log("[PARTY_SYNC] 最终 party 顺序:", party.map(p => `${p.getNameToRender()}(${p.species.speciesId})`).join(", "));

      coop.setPartySynced();
      this.end();
    });

    // 30s 超时
    setTimeout(() => {
      console.log("[PARTY_SYNC] 超时");
      this.end();
    }, 30000);
  }
}
