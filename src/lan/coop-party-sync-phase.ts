/**
 * 队伍同步 Phase - 交换初始宝可梦数据
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
    lm.on("party-sync", (party: any[], sender?: string) => {
      // 忽略自己发出的消息（Socket.io 广播会回弹）
      if (sender === lm.getRole()) return;
      // 忽略和自己的第一只宝可梦相同的（双重保险）
      if (party[0]?.speciesId === myFirstSpecies) return;

      for (const pd of party) {
        const species = globalScene.speciesDataRegistry.getSpecies(pd.speciesId);
        if (!species) continue;
        const rp = globalScene.addPlayerPokemon(
          species, pd.level, 0, pd.formIndex, pd.gender, pd.shiny,
          0, [15, 15, 15, 15, 15, 15], 0,
        );
        rp.hp = pd.hp;
      }
      coop.setPartySynced();
      this.end();
    });

    // 30s 超时
    setTimeout(() => { this.end(); }, 30000);
  }
}
