import { Player } from '../game-objects/Player';
import { Treant } from '../game-objects/Treant';
import { Mole } from '../game-objects/Mole';
import { Npc } from '../game-objects/Npc';
import { mapContentKeys } from '../constants/map-content-keys';
import { ASSETS } from '../constants/assets';

const CAMERA_LERP = 1;
const PLAYER_INITIAL_POSITION = {
  x: 50,
  y: 200,
};

interface InterSceneData {
  comesFrom: string;
}

export abstract class AbstractScene extends Phaser.Scene {
  public player: Player;
  public cursors: CursorKeys;
  public npcs: Npc[];
  public treants: Treant[];
  public moles: Mole[];
  public map: Phaser.Tilemaps.Tilemap;
  public treantGroup: Phaser.Physics.Arcade.Group;
  public moleGroup: Phaser.Physics.Arcade.Group;
  public layers: {
    terrain: Phaser.Tilemaps.StaticTilemapLayer;
    deco: Phaser.Tilemaps.StaticTilemapLayer;
    bridge: Phaser.Tilemaps.StaticTilemapLayer;
  };
  public mapKey: string;

  constructor(key: string, mapKey: string) {
    super(key);

    this.mapKey = mapKey;

    this.player = null;
    this.cursors = null;
    this.npcs = [];
    this.treants = [];
    this.treantGroup = null;
    this.moles = [];
    this.moleGroup = null;
    this.map = null;
    this.layers = null;
  }

  public update() {
    const keyPressed = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      space: this.cursors.space.isDown,
      shift: this.cursors.shift.isDown,
    };

    this.treants.map(treant => treant.update());
    this.moles.map(mole => mole.update());
    this.player.update(keyPressed);
  }

  private createMapWithLayers() {
    this.map = this.make.tilemap({ key: this.mapKey });
    const tileset = this.map.addTilesetImage(ASSETS.TILESET, ASSETS.IMAGES.TILES, 16, 16, 0, 0);

    this.layers = {
      terrain: this.map.createStaticLayer(mapContentKeys.layers.BACKGROUND, tileset, 0, 0),
      deco: this.map.createStaticLayer(mapContentKeys.layers.DECORATION, tileset, 0, 0),
      bridge: this.map.createStaticLayer(mapContentKeys.layers.BRIDGE, tileset, 0, 0),
    };
    this.layers.terrain.setCollisionByProperty({ collides: true });
    this.layers.deco.setCollisionByProperty({ collides: true });
  }

  private addColliders() {
    this.treantGroup = this.physics.add.group(this.treants.map(treant => treant.gameObject));
    this.moleGroup = this.physics.add.group(this.moles.map(mole => mole.gameObject));
    this.physics.add.collider(this.treantGroup, this.layers.terrain);
    this.physics.add.collider(this.moleGroup, this.layers.terrain);
    this.physics.add.collider(this.treantGroup, this.layers.deco);
    this.physics.add.collider(this.moleGroup, this.layers.deco);
    // TODO refactor this for performance
    this.treants.map(treant =>
      this.physics.add.collider(treant.gameObject, this.player.gameObject, treant.treantHit),
    );
    this.moles.map(mole =>
      this.physics.add.collider(mole.gameObject, this.player.gameObject, mole.moleHit),
    );

    this.physics.add.collider(this.player.gameObject, this.layers.terrain);
    this.physics.add.collider(this.player.gameObject, this.layers.deco);
    this.npcs.map(npc =>
      this.physics.add.collider(npc.gameObject, this.player.gameObject, npc.talk),
    );
  }

  private getPlayerInitialPosition(
    levelChangerObjectLayer: Phaser.Tilemaps.ObjectLayer,
    data: InterSceneData,
  ): { x: number; y: number } {
    let playerX = PLAYER_INITIAL_POSITION.x;
    let playerY = PLAYER_INITIAL_POSITION.y;

    if (data && data.comesFrom) {
      const levelChanger: any = levelChangerObjectLayer.objects.find((o: any) => {
        return o.properties.scene === data.comesFrom;
      });

      let xShift = 0;
      let yShift = 0;
      const SHIFT_VALUE = 50;
      switch (levelChanger.properties.comesBackFrom) {
        case 'right':
          xShift = SHIFT_VALUE;
          yShift = 0;
          break;
        case 'left':
          xShift = -SHIFT_VALUE;
          yShift = 0;
          break;
        case 'up':
          xShift = 0;
          yShift = -SHIFT_VALUE;
          break;
        case 'down':
          xShift = 0;
          yShift = SHIFT_VALUE;
          break;
        default:
          break;
      }

      playerX = levelChanger.x + levelChanger.width / 2 + xShift;
      playerY = levelChanger.y + levelChanger.height / 2 + yShift;
    }

    return { x: playerX, y: playerY };
  }

  private initCamera() {
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.startFollow(this.player.gameObject, true, CAMERA_LERP, CAMERA_LERP);
  }

  private init(data: InterSceneData) {
    this.createMapWithLayers();

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    const levelChangerObjectLayer = this.map.objects.find(
      o => o.name === mapContentKeys.objects.ZONES,
    );

    const playerInitialPosition = this.getPlayerInitialPosition(levelChangerObjectLayer, data);
    this.player = new Player(this, playerInitialPosition.x, playerInitialPosition.y);

    const npcsMapObjects = this.map.objects.find(o => o.name === mapContentKeys.objects.NPCS);
    const npcs: any = npcsMapObjects ? npcsMapObjects.objects : [];
    this.npcs = npcs.map(npc => {
      return new Npc(this, npc.x, npc.y, npc.properties.message);
    });

    const treantsMapObjects = this.map.objects.find(o => o.name === mapContentKeys.objects.TREANTS);
    const molesMapObjects = this.map.objects.find(o => o.name === mapContentKeys.objects.MOLES);
    const treants: any = treantsMapObjects ? treantsMapObjects.objects : [];
    const moles: any = molesMapObjects ? molesMapObjects.objects : [];

    this.treants = treants.map(treant => {
      return new Treant(this, treant.x, treant.y);
    });
    this.moles = moles.map(mole => {
      return new Mole(this, mole.x, mole.y);
    });
    if (levelChangerObjectLayer) {
      levelChangerObjectLayer.objects.map((o: any) => {
        const zone = this.add.zone(o.x, o.y, o.width, o.height);
        this.physics.add.existing(zone);
        this.physics.add.overlap(zone, this.player.gameObject, () => {
          this.scene.start(o.properties.scene, { comesFrom: this.scene.key });
        });
      });
    }

    this.addColliders();

    this.initCamera();

    this.cursors = this.input.keyboard.createCursorKeys();
  }
}