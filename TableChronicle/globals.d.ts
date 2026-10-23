// 全局变量类型声明 - 脚本标签项目
// 运行时由 HTML 中的 <script> 标签加载

/** 角色数据对象 */
declare var character: any;
/** 数据缓存（JSON 数据） */
declare var dataCache: any;
/** 规则处理器集合 */
declare var handlers: any;
/** 代码处理器集合 */
declare var CodeHandlers: any;
/** 升级状态 */
declare var upgradeState: any;
/** 属性设置状态 */
declare var abilityState: any;
/** 当前步骤 */
declare var currentStep: any;
/** 进度回调 */
declare var updateProgress: any;

// 第三方库
declare var $: any;
declare var jQuery: any;
declare var html2canvas: any;
declare var jspdf: any;
declare var layui: any;

// 工具函数
declare function escapeHtml(str: string): string;
declare function getAbilityNameById(id: number): string;
declare function getSkillName(id: number): string;
declare function calcMod(val: number): number;
declare function findById(arr: any[], id: any): any;
declare function toCP(currency: any): number;
declare function parsePrice(price: any): number;
declare function formatCurrency(cp: any): string;