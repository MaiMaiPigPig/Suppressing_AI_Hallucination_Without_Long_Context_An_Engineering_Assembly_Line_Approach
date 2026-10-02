import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    rules: {},
    languageOptions: {
      globals: {
        ...globals.browser,
        // jQuery
        $: "readonly",
        jQuery: "readonly",
        // 第三方 CDN 库
        html2canvas: "readonly",
        jspdf: "readonly",
        layui: "readonly",
        // 应用全局对象
        character: "writable",
        dataCache: "writable",
        handlers: "writable",
        CodeHandlers: "writable",
        // 跨文件共享函数 / 变量
        getCountFromProficiencyRef: "readonly",
        parseProficiencyLinkIds: "readonly",
        getClassFeatures: "readonly",
        getSubclassFeatures: "readonly",
        processFeatureRules: "readonly",
        restoreSavedSelectionsToState: "readonly",
        findItemSourceTable: "readonly",
        addPendingSelectionsFromItem: "readonly",
        collectAllClassExtraAll: "readonly",
        getSpellSlotsForLevel: "readonly",
        getSpellPrepForLevel: "readonly",
        getCantripCountForLevel: "readonly",
        getFeatureProficiencyValues: "readonly",
        renderCharacterSheet: "readonly",
        upgradeState: "readonly",
        getSpellDataFromProficiency: "readonly",
        buildSpellDetailHTML: "readonly",
        getProfBonus: "readonly",
        getAbilityNameById: "readonly",
        getSpellMethodInfo: "readonly",
        renderUpgradeSpellSection: "readonly",
        calcMod: "readonly",
        ABILITY_NAMES: "readonly",
        buildDataIndexes: "readonly",
        escapeHtml: "readonly",
        updateProgress: "readonly",
        unbind: "writable",
        currentStep: "writable",
        collectChainedRaceFeatures: "readonly",
        renderStep: "readonly",
        formatCurrency: "readonly",
        clearDataAfterStep: "readonly",
        updateButtons: "readonly",
        getRaceFeatures: "readonly",
        getSkillName: "readonly",
        parsePrice: "readonly",
        collectAllFeatureBonuses: "readonly",
        replacePlaceholdersInText: "readonly",
        clearAllPendingSelections: "readonly",
        formatAbilityDisplay: "readonly",
        renderFeatureSelectionStep: "readonly",
        renderAbilityStep: "readonly",
        toCP: "readonly",
        getRaceAbilityBonus: "readonly",
        fillCurrencyFromPackage: "readonly",
        parseSpellCounts: "readonly",
        getMethodNameById: "readonly",
        renderSubclassSelection: "readonly",
        applyDLCFilter: "readonly",
        deductCurrency: "readonly",
        renderBonusStep: "readonly",
        renderSkillStep: "readonly",
        renderFeatStep: "readonly",
        renderSpellStep: "readonly",
        renderShoppingStep: "readonly",
        renderReviewStep: "readonly",
        renderDetailsStep: "readonly",
        renderExportStep: "readonly",
        LEVEL1_BASE_SPELLS: "readonly",
        getCurrencyCP: "readonly",
        goUpgrade: "readonly",
        confirmAllSelections: "readonly",
        abilityState: "writable",
        hasPendingSelections: "readonly",
        renderDLCStep: "readonly",
        renderRaceStep: "readonly",
        renderSubraceStep: "readonly",
        renderClassStep: "readonly",
        renderPackageStep: "readonly",
        renderBackgroundStep: "readonly",
        renderBackgroundPackageStep: "readonly",
        renderBackgroundBonusStep: "readonly",
      }
    }
  },
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "script" }
  },
  {
    // v0.4 代码迁移后，这四层已全部改为 ES Module（import/export）。
    // 必须放在 script 块之后：flat config 后面匹配到的块覆盖前面，否则会被判成
    // "import/export may appear only with sourceType: module"。
    // upgrade/ 与 code-handlers/ 仍是传统 defer 脚本，不在其列。
    files: [
      "TableChronicle/character/dnd_5r/core/**/*.js",
      "TableChronicle/character/dnd_5r/creation/**/*.js",
      "TableChronicle/character/dnd_5r/handlers/**/*.js",
      "TableChronicle/character/dnd_5r/utils/**/*.js",
    ],
    languageOptions: { sourceType: "module" }
  },
]);