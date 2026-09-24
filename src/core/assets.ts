import badge from 'assets/images/badge.webp';
import bar_fill from 'assets/images/bar_fill.webp';
import bar_track from 'assets/images/bar_track.webp';
import broom from 'assets/images/broom.webp';
import btn_play from 'assets/images/btn_play.webp';
import check from 'assets/images/check.webp';
import conf_circle from 'assets/images/conf_circle.webp';
import conf_curl from 'assets/images/conf_curl.webp';
import conf_rect from 'assets/images/conf_rect.webp';
import conf_star from 'assets/images/conf_star.webp';
import conf_tri from 'assets/images/conf_tri.webp';
import dot from 'assets/images/dot.webp';
import hand from 'assets/images/hand.webp';
import icon_broom from 'assets/images/icon_broom.webp';
import icon_chair from 'assets/images/icon_chair.webp';
import icon_floor from 'assets/images/icon_floor.webp';
import icon_house from 'assets/images/icon_house.webp';
import icon_lock from 'assets/images/icon_lock.webp';
import icon_roller_yellow from 'assets/images/icon_roller_yellow.webp';
import logo from 'assets/images/logo.webp';
import panel from 'assets/images/panel.webp';
import pill from 'assets/images/pill.webp';
import puff from 'assets/images/puff.webp';
import rays from 'assets/images/rays.webp';
import ribbon from 'assets/images/ribbon.webp';
import ring from 'assets/images/ring.webp';
import roller from 'assets/images/roller.webp';
import roller_foam from 'assets/images/roller_foam.webp';
import slot from 'assets/images/slot.webp';
import slot_active from 'assets/images/slot_active.webp';
import sparkle from 'assets/images/sparkle.webp';
import splat from 'assets/images/splat.webp';
import swatch from 'assets/images/swatch.webp';
import swatch_active from 'assets/images/swatch_active.webp';
import swatch_gloss from 'assets/images/swatch_gloss.webp';

import bush from 'assets/models/bush.glb';
import cloud from 'assets/models/cloud.glb';
import debris_bag from 'assets/models/debris_bag.glb';
import debris_barrel from 'assets/models/debris_barrel.glb';
import debris_box from 'assets/models/debris_box.glb';
import debris_bricks from 'assets/models/debris_bricks.glb';
import debris_can from 'assets/models/debris_can.glb';
import debris_mud from 'assets/models/debris_mud.glb';
import debris_planks from 'assets/models/debris_planks.glb';
import debris_rock_a from 'assets/models/debris_rock_a.glb';
import debris_rock_b from 'assets/models/debris_rock_b.glb';
import debris_tire from 'assets/models/debris_tire.glb';
import debris_weeds from 'assets/models/debris_weeds.glb';
import fence from 'assets/models/fence.glb';
import flowers from 'assets/models/flowers.glb';
import ground from 'assets/models/ground.glb';
import house_broken from 'assets/models/house_broken.glb';
import house_painted from 'assets/models/house_painted.glb';
import house_unpainted from 'assets/models/house_unpainted.glb';
import tree_pine from 'assets/models/tree_pine.glb';
import tree_round from 'assets/models/tree_round.glb';

import music_loop from 'assets/sounds/music_loop.mp3';
import sfx_color from 'assets/sounds/sfx_color.mp3';
import sfx_confetti from 'assets/sounds/sfx_confetti.mp3';
import sfx_ding from 'assets/sounds/sfx_ding.mp3';
import sfx_paint from 'assets/sounds/sfx_paint.mp3';
import sfx_poof from 'assets/sounds/sfx_poof.mp3';
import sfx_pop from 'assets/sounds/sfx_pop.mp3';
import sfx_select from 'assets/sounds/sfx_select.mp3';
import sfx_stamp from 'assets/sounds/sfx_stamp.mp3';
import sfx_step from 'assets/sounds/sfx_step.mp3';
import sfx_sweep1 from 'assets/sounds/sfx_sweep1.mp3';
import sfx_sweep2 from 'assets/sounds/sfx_sweep2.mp3';
import sfx_tap from 'assets/sounds/sfx_tap.mp3';
import sfx_transform from 'assets/sounds/sfx_transform.mp3';
import sfx_whoosh from 'assets/sounds/sfx_whoosh.mp3';
import sfx_win from 'assets/sounds/sfx_win.mp3';

import lilita from 'assets/fonts/LilitaOne-Regular.ttf';

export const FONT_FAMILY = 'Lilita One';
export const FontResource = lilita as string;

export const ImagesResources: Record<string, string> = {
  badge, bar_fill, bar_track, broom, btn_play, check, conf_circle, conf_curl, conf_rect, conf_star, conf_tri,
  dot, hand, icon_broom, icon_chair, icon_floor, icon_house, icon_lock, icon_roller_yellow, logo, panel, pill, puff,
  rays, ribbon, ring, roller, roller_foam, slot, slot_active, sparkle, splat, swatch, swatch_active, swatch_gloss
};

export const ModelResources: Record<string, string> = {
  bush, cloud, debris_bag, debris_barrel, debris_box, debris_bricks, debris_can, debris_mud, debris_planks,
  debris_rock_a, debris_rock_b, debris_tire, debris_weeds, fence, flowers, ground, house_broken, house_painted,
  house_unpainted, tree_pine, tree_round
};

export const SoundResources: Record<string, string> = {
  sfx_color, sfx_confetti, sfx_ding, sfx_paint, sfx_poof, sfx_pop, sfx_select, sfx_stamp, sfx_step, sfx_sweep1,
  sfx_sweep2, sfx_tap, sfx_transform, sfx_whoosh, sfx_win
};

// Loop window skips the mp3 encoder delay; the file carries a copy of the loop head
// after its end, so any start inside that pad lands on identical audio
export const MusicResource = { src: music_loop as string, loopStartMs: 100, loopMs: 8571.429 };
