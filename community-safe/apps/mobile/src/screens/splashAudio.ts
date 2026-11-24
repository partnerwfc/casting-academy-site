import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Son d'ouverture : respecte le mode silencieux de l'iPhone (catégorie « ambiant »), se mélange aux autres sons.
export const Audio = {
  async load(): Promise<{ play: () => void; stop: () => void } | null> {
    try {
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', allowsRecording: false, shouldPlayInBackground: false });
      const player = createAudioPlayer(require('../../assets/sounds/splash.wav'));
      player.volume = 0.9;
      return { play: () => player.play(), stop: () => { try { player.pause(); player.remove(); } catch { /* déjà libéré */ } } };
    } catch {
      return null; // pas de son : l'animation joue quand même
    }
  },
};
