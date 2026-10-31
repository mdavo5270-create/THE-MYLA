import * as THREE from 'three';

export interface BuildingDefinition {
  id: string;
  name: string;
  category: 'habitation' | 'defense' | 'production' | 'decoration' | 'infrastructure';
  icon: string;
  description: string;
  width: number; // en nombre de tuiles
  height: number; // en nombre de tuiles
  canPlaceOnWater: boolean;
  createMesh: () => THREE.Group;
}

/**
 * Modèles 3D détaillés et réalistes pour tous les bâtiments et éléments posables.
 * Conçus avec des matériaux PBR (bois, pierre, tuiles, fer, vitres lumineuses).
 */
export class BuildingModels {
  // Matériaux partagés
  private static stoneMat = new THREE.MeshStandardMaterial({
    color: 0x7a7d82,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
  });

  private static woodMat = new THREE.MeshStandardMaterial({
    color: 0x5a3d28,
    roughness: 0.75,
    metalness: 0.05,
    flatShading: true,
  });

  private static roofMat = new THREE.MeshStandardMaterial({
    color: 0x9e382b, // Tuiles terre cuite rouge-brun
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
  });

  private static plasterMat = new THREE.MeshStandardMaterial({
    color: 0xddd7c8, // Crépi beige médiéval
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true,
  });

  private static windowEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xffdd88,
    emissive: 0xffaa33,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  private static ironMat = new THREE.MeshStandardMaterial({
    color: 0x222226,
    roughness: 0.4,
    metalness: 0.8,
  });

  private static waterMat = new THREE.MeshStandardMaterial({
    color: 0x1d9bf0,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
  });

  private static foliageMat = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  });

  private static wheatMat = new THREE.MeshStandardMaterial({
    color: 0xdda832,
    roughness: 0.7,
    flatShading: true,
  });

  /**
   * Maison de village médiévale avec toit à double pente en tuiles,
   * poutres en bois apparentes, porte et fenêtres lumineuses.
   */
  static createHouse(): THREE.Group {
    const group = new THREE.Group();

    // Base en pierre
    const baseGeom = new THREE.BoxGeometry(1.6, 0.4, 1.6);
    const base = new THREE.Mesh(baseGeom, this.stoneMat);
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Murs en crépi
    const wallsGeom = new THREE.BoxGeometry(1.5, 1.1, 1.5);
    const walls = new THREE.Mesh(wallsGeom, this.plasterMat);
    walls.position.y = 0.95;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Poutres d'angles (colombages)
    const beamGeom = new THREE.BoxGeometry(0.12, 1.15, 0.12);
    const corners = [
      [-0.75, 0.95, -0.75],
      [0.75, 0.95, -0.75],
      [-0.75, 0.95, 0.75],
      [0.75, 0.95, 0.75],
    ];
    corners.forEach(([x, y, z]) => {
      const beam = new THREE.Mesh(beamGeom, this.woodMat);
      beam.position.set(x!, y!, z!);
      beam.castShadow = true;
      group.add(beam);
    });

    // Toit en pente
    const roofGeom = new THREE.ConeGeometry(1.35, 0.9, 4);
    roofGeom.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeom, this.roofMat);
    roof.position.y = 1.95;
    roof.scale.set(1.1, 1.0, 1.1);
    roof.castShadow = true;
    group.add(roof);

    // Cheminée en brique/pierre
    const chimneyGeom = new THREE.BoxGeometry(0.28, 0.8, 0.28);
    const chimney = new THREE.Mesh(chimneyGeom, this.stoneMat);
    chimney.position.set(0.45, 2.0, 0.35);
    chimney.castShadow = true;
    group.add(chimney);

    // Porte en bois
    const doorGeom = new THREE.BoxGeometry(0.35, 0.65, 0.05);
    const door = new THREE.Mesh(doorGeom, this.woodMat);
    door.position.set(0, 0.7, 0.76);
    group.add(door);

    // Fenêtres lumineuses émissives (qui s'illuminent le soir)
    const winGeom = new THREE.BoxGeometry(0.28, 0.28, 0.04);
    const win1 = new THREE.Mesh(winGeom, this.windowEmissiveMat);
    win1.position.set(-0.4, 1.0, 0.76);
    group.add(win1);

    const win2 = new THREE.Mesh(winGeom, this.windowEmissiveMat);
    win2.position.set(0.4, 1.0, 0.76);
    group.add(win2);

    const winSide = new THREE.Mesh(winGeom, this.windowEmissiveMat);
    winSide.position.set(0.76, 1.0, 0);
    winSide.rotation.y = Math.PI / 2;
    group.add(winSide);

    // Petite lumière ponctuelle chaleureuse pour la nuit
    const houseLight = new THREE.PointLight(0xffb84d, 0.8, 3.5);
    houseLight.position.set(0, 1.0, 0.8);
    group.add(houseLight);

    return group;
  }

  /**
   * Tour de garde fortifiée en pierre avec créneaux et brasero supérieur.
   */
  static createWatchtower(): THREE.Group {
    const group = new THREE.Group();

    // Base élargie
    const baseGeom = new THREE.CylinderGeometry(0.85, 1.0, 0.6, 8);
    const base = new THREE.Mesh(baseGeom, this.stoneMat);
    base.position.y = 0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Corps de la tour
    const shaftGeom = new THREE.CylinderGeometry(0.75, 0.85, 2.2, 8);
    const shaft = new THREE.Mesh(shaftGeom, this.stoneMat);
    shaft.position.y = 1.7;
    shaft.castShadow = true;
    group.add(shaft);

    // Plateforme supérieure élargie
    const platGeom = new THREE.CylinderGeometry(1.0, 0.8, 0.35, 8);
    const plat = new THREE.Mesh(platGeom, this.stoneMat);
    plat.position.y = 2.95;
    plat.castShadow = true;
    group.add(plat);

    // Créneaux
    for (let i = 0; i < 8; i += 2) {
      const angle = (i / 8) * Math.PI * 2;
      const battGeom = new THREE.BoxGeometry(0.28, 0.35, 0.15);
      const batt = new THREE.Mesh(battGeom, this.stoneMat);
      batt.position.set(Math.cos(angle) * 0.9, 3.25, Math.sin(angle) * 0.9);
      batt.rotation.y = -angle;
      batt.castShadow = true;
      group.add(batt);
    }

    // Brasero central au sommet
    const brazierGeom = new THREE.CylinderGeometry(0.25, 0.15, 0.3, 6);
    const brazier = new THREE.Mesh(brazierGeom, this.ironMat);
    brazier.position.y = 3.25;
    group.add(brazier);

    // Flamme / braise émissive
    const fireGeom = new THREE.DodecahedronGeometry(0.18);
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff7700,
      emissiveIntensity: 1.5,
    });
    const fire = new THREE.Mesh(fireGeom, fireMat);
    fire.position.y = 3.45;
    group.add(fire);

    // Lumière de la torche
    const towerLight = new THREE.PointLight(0xff7722, 1.4, 5.0);
    towerLight.position.set(0, 3.5, 0);
    group.add(towerLight);

    return group;
  }

  /**
   * Moulin à vent avec corps conique, toit pointu et pales d'hélice.
   */
  static createWindmill(): THREE.Group {
    const group = new THREE.Group();

    // Tour conique
    const bodyGeom = new THREE.CylinderGeometry(0.7, 0.95, 2.2, 8);
    const body = new THREE.Mesh(bodyGeom, this.plasterMat);
    body.position.y = 1.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Toit conique en bois
    const roofGeom = new THREE.ConeGeometry(0.85, 0.8, 8);
    const roof = new THREE.Mesh(roofGeom, this.roofMat);
    roof.position.y = 2.6;
    roof.castShadow = true;
    group.add(roof);

    // Moyeu des ailes
    const hubGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.25, 8);
    hubGeom.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeom, this.woodMat);
    hub.position.set(0, 2.1, 0.78);
    group.add(hub);

    // Ailes rotatives (Group pour animation)
    const rotor = new THREE.Group();
    rotor.name = 'windmill_rotor';
    rotor.position.set(0, 2.1, 0.88);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const bladeArm = new THREE.BoxGeometry(0.06, 1.4, 0.04);
      bladeArm.translate(0, 0.7, 0);

      const sailGeom = new THREE.PlaneGeometry(0.35, 1.1);
      sailGeom.translate(0.18, 0.75, 0.02);

      const sailMat = new THREE.MeshStandardMaterial({
        color: 0xeeece5,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

      const armMesh = new THREE.Mesh(bladeArm, this.woodMat);
      const sailMesh = new THREE.Mesh(sailGeom, sailMat);

      const blade = new THREE.Group();
      blade.add(armMesh);
      blade.add(sailMesh);
      blade.rotation.z = angle;

      rotor.add(blade);
    }
    group.add(rotor);

    // Porte
    const doorGeom = new THREE.BoxGeometry(0.3, 0.6, 0.05);
    const door = new THREE.Mesh(doorGeom, this.woodMat);
    door.position.set(0, 0.35, 0.93);
    group.add(door);

    return group;
  }

  /**
   * Lanterne de rue / Lampadaire médiéval en fer forgé.
   * Émet une vraie lumière dorée intense la nuit.
   */
  static createStreetlamp(): THREE.Group {
    const group = new THREE.Group();

    // Poteau en fer forgé
    const poleGeom = new THREE.CylinderGeometry(0.06, 0.09, 1.8, 6);
    const pole = new THREE.Mesh(poleGeom, this.ironMat);
    pole.position.y = 0.9;
    pole.castShadow = true;
    group.add(pole);

    // Bras courbé
    const armGeom = new THREE.BoxGeometry(0.05, 0.05, 0.4);
    const arm = new THREE.Mesh(armGeom, this.ironMat);
    arm.position.set(0, 1.75, 0.15);
    group.add(arm);

    // Cage de la lanterne
    const cageGeom = new THREE.BoxGeometry(0.24, 0.35, 0.24);
    const cage = new THREE.Mesh(cageGeom, this.ironMat);
    cage.position.set(0, 1.65, 0.32);
    group.add(cage);

    // Verre lumineux intérieur
    const glassGeom = new THREE.BoxGeometry(0.18, 0.28, 0.18);
    const glass = new THREE.Mesh(glassGeom, this.windowEmissiveMat);
    glass.position.set(0, 1.65, 0.32);
    group.add(glass);

    // Lumière ponctuelle dorée intense
    const lampLight = new THREE.PointLight(0xffaa22, 1.8, 6.0, 1.2);
    lampLight.position.set(0, 1.65, 0.32);
    lampLight.castShadow = true;
    lampLight.shadow.bias = -0.002;
    group.add(lampLight);

    return group;
  }

  /**
   * Dalle de route / Chemin de pavés en pierre biseautée.
   */
  static createRoad(): THREE.Group {
    const group = new THREE.Group();

    const roadGeom = new THREE.BoxGeometry(1.9, 0.12, 1.9);
    const road = new THREE.Mesh(roadGeom, this.stoneMat);
    road.position.y = 0.06;
    road.receiveShadow = true;
    group.add(road);

    // Pavés individuels en surélévation subtile
    const cobbleMat = new THREE.MeshStandardMaterial({
      color: 0x858991,
      roughness: 0.8,
      flatShading: true,
    });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const cx = (i - 1.5) * 0.45;
        const cz = (j - 1.5) * 0.45;
        const cobbleGeom = new THREE.BoxGeometry(0.38, 0.06, 0.38);
        const cobble = new THREE.Mesh(cobbleGeom, cobbleMat);
        cobble.position.set(cx, 0.14, cz);
        cobble.receiveShadow = true;
        group.add(cobble);
      }
    }

    return group;
  }

  /**
   * Fontaine de place de village avec vasque en pierre et eau.
   */
  static createFountain(): THREE.Group {
    const group = new THREE.Group();

    // Bassin octogonal
    const basinGeom = new THREE.CylinderGeometry(0.95, 1.05, 0.45, 8);
    const basin = new THREE.Mesh(basinGeom, this.stoneMat);
    basin.position.y = 0.22;
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);

    // Surface de l'eau
    const waterGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 8);
    const water = new THREE.Mesh(waterGeom, this.waterMat);
    water.position.y = 0.4;
    group.add(water);

    // Pilier central
    const pillarGeom = new THREE.CylinderGeometry(0.2, 0.25, 0.9, 8);
    const pillar = new THREE.Mesh(pillarGeom, this.stoneMat);
    pillar.position.y = 0.7;
    pillar.castShadow = true;
    group.add(pillar);

    // Vasque supérieure
    const upperBasinGeom = new THREE.CylinderGeometry(0.45, 0.3, 0.2, 8);
    const upperBasin = new THREE.Mesh(upperBasinGeom, this.stoneMat);
    upperBasin.position.y = 1.15;
    upperBasin.castShadow = true;
    group.add(upperBasin);

    return group;
  }

  /**
   * Parcelle de ferme / champs de blé dorés.
   */
  static createFarm(): THREE.Group {
    const group = new THREE.Group();

    // Sol en terre labourée
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x4a3319, roughness: 0.9 });
    const soilGeom = new THREE.BoxGeometry(1.85, 0.1, 1.85);
    const soil = new THREE.Mesh(soilGeom, soilMat);
    soil.position.y = 0.05;
    soil.receiveShadow = true;
    group.add(soil);

    // Rangées de blé
    for (let r = -0.65; r <= 0.65; r += 0.32) {
      const rowGeom = new THREE.BoxGeometry(1.6, 0.35, 0.18);
      const row = new THREE.Mesh(rowGeom, this.wheatMat);
      row.position.set(0, 0.25, r);
      row.castShadow = true;
      group.add(row);
    }

    return group;
  }

  /**
   * Arbre d'ornement pour parcs et jardins.
   */
  static createDecorativeTree(): THREE.Group {
    const group = new THREE.Group();

    // Tronc
    const trunkGeom = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 6);
    const trunk = new THREE.Mesh(trunkGeom, this.woodMat);
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);

    // Feuillage étagé
    const f1 = new THREE.DodecahedronGeometry(0.85);
    const foliage1 = new THREE.Mesh(f1, this.foliageMat);
    foliage1.position.y = 1.6;
    foliage1.castShadow = true;
    group.add(foliage1);

    const f2 = new THREE.DodecahedronGeometry(0.65);
    const foliage2 = new THREE.Mesh(f2, this.foliageMat);
    foliage2.position.set(0.2, 2.2, -0.1);
    foliage2.castShadow = true;
    group.add(foliage2);

    return group;
  }

  /**
   * Liste complète des définitions de bâtiments disponibles.
   */
  static getAllDefinitions(): BuildingDefinition[] {
    return [
      {
        id: 'house',
        name: 'Maisonnette',
        category: 'habitation',
        icon: '🏠',
        description: 'Maison chaleureuse avec fenêtres illuminées la nuit.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createHouse(),
      },
      {
        id: 'watchtower',
        name: 'Tour de Guet',
        category: 'defense',
        icon: '🏰',
        description: 'Tour fortifiée en pierre avec brasero au sommet.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createWatchtower(),
      },
      {
        id: 'windmill',
        name: 'Moulin à Vent',
        category: 'production',
        icon: '🌾',
        description: 'Moulin traditionnel avec ailes tournantes animées.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createWindmill(),
      },
      {
        id: 'streetlamp',
        name: 'Lampadaire',
        category: 'infrastructure',
        icon: '🏮',
        description: 'Lanterne en fer forgé diffusant une lumière dorée la nuit.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createStreetlamp(),
      },
      {
        id: 'road',
        name: 'Route Pavée',
        category: 'infrastructure',
        icon: '🛤️',
        description: 'Dalles de pierre pour connecter vos quartiers.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createRoad(),
      },
      {
        id: 'fountain',
        name: 'Fontaine',
        category: 'decoration',
        icon: '⛲',
        description: 'Bassin ornemental pour le centre de votre village.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createFountain(),
      },
      {
        id: 'farm',
        name: 'Champs de Blé',
        category: 'production',
        icon: '🚜',
        description: 'Parcelle agricole aux sillons dorés.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createFarm(),
      },
      {
        id: 'tree',
        name: 'Arbre Ornemental',
        category: 'decoration',
        icon: '🌳',
        description: 'Chêne verdoyant pour embellir les tuiles.',
        width: 1,
        height: 1,
        canPlaceOnWater: false,
        createMesh: () => this.createDecorativeTree(),
      },
    ];
  }
}
