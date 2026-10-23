import { clearDataAfterStep } from '../../core/state/character-state.js';
import { updateProgress, updateButtons } from './navigation.js';
import { getCurrentStep, setCurrentStep, loadCharacterFromJSON } from './lifecycle.js';

window.clearDataAfterStep = clearDataAfterStep;
window.updateProgress = updateProgress;
window.updateButtons = updateButtons;
window.loadCharacterFromJSON = loadCharacterFromJSON;
Object.defineProperty(window, 'currentStep', {
    get: getCurrentStep,
    set: setCurrentStep,
    enumerable: true
});