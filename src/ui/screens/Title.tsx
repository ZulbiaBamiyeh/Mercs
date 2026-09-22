import { motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { play } from '../sfx';
import { Embers } from '../components/Embers';

export function Title({ onStart }: { onStart: () => void }) {
  return (
    <div className="title-screen">
      <Embers count={46} />
      <div className="title-vignette" />
      <motion.div
        className="title-crest"
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="crest-emblem">
          <Icon name="crossed-swords" size={120} />
        </div>
        <h1 className="logo">Mercs</h1>
        <div className="logo-rule"><span /><Icon name="laurel-crown" size={30} /><span /></div>
        <p className="tagline">Six blades for hire. Three on the table. The fastest hand strikes first.</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="title-actions"
      >
        <button className="btn-brass btn-xl" type="button" onClick={() => { play('ready'); onStart(); }}>
          Assemble your party
        </button>
        <div className="title-legend">
          <span className="legend-item role-protector"><Icon name="shield" size={22} /> Protector</span>
          <span className="legend-arrow">beats</span>
          <span className="legend-item role-fighter"><Icon name="broadsword" size={22} /> Fighter</span>
          <span className="legend-arrow">beats</span>
          <span className="legend-item role-caster"><Icon name="crystal-ball" size={22} /> Caster</span>
          <span className="legend-arrow">beats</span>
          <span className="legend-item role-protector"><Icon name="shield" size={22} /> Protector</span>
        </div>
      </motion.div>
    </div>
  );
}
