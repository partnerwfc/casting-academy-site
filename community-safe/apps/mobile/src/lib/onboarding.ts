import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO = 'smc-intro-seen';
const DONE = 'smc-onboarded';
export const introSeen = async () => (await AsyncStorage.getItem(INTRO)) === '1';
export const markIntroSeen = () => AsyncStorage.setItem(INTRO, '1');
export const onboarded = async () => (await AsyncStorage.getItem(DONE)) === '1';
export const markOnboarded = () => AsyncStorage.setItem(DONE, '1');
