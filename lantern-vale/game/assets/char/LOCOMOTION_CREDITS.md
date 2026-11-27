# 角色移動動畫來源

五組動作由 Quaternius 與 Gonzalo Furnier 的 [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) 提供，依 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 使用。

| 遊戲動作 | 原始片段 |
| --- | --- |
| 行走 | Walk_Loop |
| 衝刺 | Sprint_Loop |
| 持武後退 | Jog_Bwd_Loop |
| 持武左移 | Jog_Left_Loop |
| 持武右移 | Jog_Right_Loop |

從 [固定版本鏡像](https://github.com/tilakpatell/tilakverse-assets/blob/85064399bbdacc0e8cc50807179490314bc4ff1c/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb) 取得原地動作的 GLB。來源 SHA-256 為 `d1cb4537efa4c06a953ca951e5935062f88c2580ac68e45045592d587bddb43d`。

`node tools/retarget_locomotion.mjs /path/to/UAL1.glb` 會把髖、膝和踝關節的旋轉轉換到現有冒險者骨架。遊戲把這些片段與各職業持武上半身動畫合成，並由移動系統控制角色的位置。
