const STORAGE_KEY = 'dart_tycoon_save';

const DEFAULT_SAVE = {
    money: 0,
    throws: 0,
    highScore: 0,
    totalEarned: 0,
    level: 1,
    exp: 0,
    inventory: {},
    activeEffects: {
        precision: 0,
        double: 0,
        lucky: 0,
        multi: 0,
        triple: 0,
        fivex: 0,
        quad: 0,
        quint: 0,
        perfect: 0,
        auto: 0
    },
    permanentStats: {
        goldBonus: 0,
        accuracyBonus: 0,
        expBonus: 0,
        critChance: 0,
        critMultiplier: 0,
        luckBonus: 0,
        comboBonus: 0
    },
    unlockedSkins: ['default'],
    currentSkin: 'default',
    combo: 0,
    maxCombo: 0,
    critStreak: 0,
    todayTasks: [],
    todayDate: '',
    luckValue: 0,
    totalCrits: 0,
    skills: {
        aimLock: { level: 0, cooldown: 0 },
        timeSlow: { level: 0, cooldown: 0 },
        magnet: { level: 0, cooldown: 0 },
        powerThrow: { level: 0, cooldown: 0 }
    },
    achievements: {},
    lastOnlineTime: Date.now(),
    offlineEarnings: 0,
    leaderboard: [],
    completedChallenges: [],
    currentTheme: 'light',
    totalBullseyes: 0,
    consecutiveHits: 0,
    maxConsecutiveHits: 0,
    throwStreak: 0,
    maxThrowStreak: 0,
    totalGames: 1,
    currentChallenge: null,
    challengeProgress: 0,
    checkInDays: 0,
    lastCheckInDate: '',
    seasonLevel: 1,
    seasonExp: 0,
    seasonPass: 'free',
    seasonRewards: [],
    currentEvent: null,
    eventProgress: 0,
    dailyRandomEvent: null,
    randomEventCooldown: 0,
    customDarts: [],
    limitedShopLastRefresh: 0,
    limitedShopItems: [],
    hasAppreciated: false
};

function loadGame() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data && data !== 'undefined') {
            const saved = JSON.parse(data);
            const merged = { ...DEFAULT_SAVE, ...saved };
            // 旧存档可能用的是dark主题，强制升级为light
            if (!THEMES[merged.currentTheme] || merged.currentTheme === 'dark') {
                merged.currentTheme = 'light';
            }
            return merged;
        }
    } catch (e) {
        console.error('加载存档失败', e);
        // 清除损坏的存档
        localStorage.removeItem(STORAGE_KEY);
    }
    return { ...DEFAULT_SAVE };
}

function saveGame(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('保存存档失败', e);
    }
}

const DAILY_TASKS = [
    { id: 'throw_50', name: '投掷达人', desc: '投掷50次', target: 50, reward: { type: 'gold', amount: 500 }, icon: '🎯' },
    { id: 'hit_bullseye', name: '一箭穿心', desc: '命中靶心10次', target: 10, reward: { type: 'item', itemId: 'perfect' }, icon: '🎯' },
    { id: 'earn_gold', name: '日进斗金', desc: '赚取5000金币', target: 5000, reward: { type: 'gold', amount: 1000 }, icon: '💰' },
    { id: 'combo_10', name: '连击达人', desc: '达成10连击', target: 10, reward: { type: 'item', itemId: 'double' }, icon: '🔥' },
    { id: 'crit_5', name: '暴击先锋', desc: '触发5次暴击', target: 5, reward: { type: 'item', itemId: 'triple' }, icon: '💥' },
    { id: 'reach_level', name: '升级冲刺', desc: '升到5级', target: 5, reward: { type: 'gold', amount: 2000 }, icon: '⬆️' },
    { id: 'max_combo', name: '极限连击', desc: '达成最大连击', target: 20, reward: { type: 'skin', skinId: 'golden' }, icon: '👑' }
];

function generateDailyTasks() {
    const today = new Date().toDateString();
    const shuffled = [...DAILY_TASKS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(task => ({
        ...task,
        progress: 0,
        completed: false,
        claimed: false
    }));
}

function checkAndResetDailyTasks(gameData) {
    const today = new Date().toDateString();
    if (gameData.todayDate !== today) {
        gameData.todayTasks = generateDailyTasks();
        gameData.todayDate = today;
    }
}

const DART_SKINS = {
    default: { id: 'default', name: '默认飞镖', icon: '🎯', color: '#ff6b35', tipColor: '#ffd700', unlocked: true, price: 0 },
    golden: { id: 'golden', name: '黄金飞镖', icon: '🏆', color: '#ffd700', tipColor: '#ff8c00', unlocked: false, price: 5000 },
    crystal: { id: 'crystal', name: '水晶飞镖', icon: '💎', color: '#00d4ff', tipColor: '#ffffff', unlocked: false, price: 8000 },
    ruby: { id: 'ruby', name: '红宝石飞镖', icon: '💎', color: '#ff0000', tipColor: '#ff6600', unlocked: false, price: 10000 },
    emerald: { id: 'emerald', name: '翡翠飞镖', icon: '💚', color: '#00ff00', tipColor: '#00cc00', unlocked: false, price: 12000 },
    sapphire: { id: 'sapphire', name: '蓝宝石飞镖', icon: '💙', color: '#0066ff', tipColor: '#00ccff', unlocked: false, price: 15000 },
    amethyst: { id: 'amethyst', name: '紫水晶飞镖', icon: '💜', color: '#9900ff', tipColor: '#cc66ff', unlocked: false, price: 18000 },
    obsidian: { id: 'obsidian', name: '黑曜石飞镖', icon: '⚫', color: '#333333', tipColor: '#666666', unlocked: false, price: 20000 },
    flame: { id: 'flame', name: '烈焰飞镖', icon: '🔥', color: '#ff4500', tipColor: '#ffcc00', unlocked: false, price: 25000 },
    ice: { id: 'ice', name: '寒冰飞镖', icon: '❄️', color: '#87ceeb', tipColor: '#ffffff', unlocked: false, price: 28000 },
    lightning: { id: 'lightning', name: '雷电飞镖', icon: '⚡', color: '#ffff00', tipColor: '#00ffff', unlocked: false, price: 32000 },
    rainbow: { id: 'rainbow', name: '彩虹飞镖', icon: '🌈', color: 'linear-gradient(180deg, #ff0000, #ff8c00, #ffff00, #00ff00, #0066ff, #9900ff)', tipColor: '#ffffff', unlocked: false, price: 50000 },
    dragon: { id: 'dragon', name: '龙鳞飞镖', icon: '🐉', color: '#8b4513', tipColor: '#ffd700', unlocked: false, price: 80000 },
    phoenix: { id: 'phoenix', name: '凤凰飞镖', icon: '🦅', color: '#ff6b6b', tipColor: '#ffd700', unlocked: false, price: 100000 },
    star: { id: 'star', name: '星辰飞镖', icon: '⭐', color: '#ffffff', tipColor: '#00d4ff', unlocked: false, price: 120000 },
    galaxy: { id: 'galaxy', name: '银河飞镖', icon: '🌌', color: '#1a0033', tipColor: '#9900ff', unlocked: false, price: 150000 },
    ghost: { id: 'ghost', name: '幽灵飞镖', icon: '👻', color: '#ffffff', tipColor: '#888888', unlocked: false, price: 60000 },
    ninja: { id: 'ninja', name: '忍者飞镖', icon: '🥷', color: '#1a1a1a', tipColor: '#ff4500', unlocked: false, price: 45000 },
    samurai: { id: 'samurai', name: '武士飞镖', icon: '⚔️', color: '#c0c0c0', tipColor: '#8b4513', unlocked: false, price: 55000 },
    pirate: { id: 'pirate', name: '海盗飞镖', icon: '🏴‍☠️', color: '#000080', tipColor: '#ffd700', unlocked: false, price: 40000 },
    knight: { id: 'knight', name: '骑士飞镖', icon: '🛡️', color: '#ffd700', tipColor: '#8b4513', unlocked: false, price: 65000 },
    wizard: { id: 'wizard', name: '巫师飞镖', icon: '🧙', color: '#9900ff', tipColor: '#00ffff', unlocked: false, price: 70000 },
    angel: { id: 'angel', name: '天使飞镖', icon: '👼', color: '#ffffff', tipColor: '#ffd700', unlocked: false, price: 90000 },
    demon: { id: 'demon', name: '恶魔飞镖', icon: '😈', color: '#8b0000', tipColor: '#ff4500', unlocked: false, price: 95000 },
    cupid: { id: 'cupid', name: '爱神飞镖', icon: '❤️', color: '#ff69b4', tipColor: '#ff1493', unlocked: false, price: 75000 },
    appreciator: { id: 'appreciator', name: '赞赏专属', icon: '💝', color: 'linear-gradient(135deg, #ff6b6b, #ffd700, #ff69b4, #ff6b6b)', tipColor: '#ffd700', unlocked: false, price: 0 }
};

function generateItems() {
    const items = {};
    
    const consumableTemplates = [
        { baseId: 'precision', name: '精准', desc: '下次投掷精准度大幅提升', price: 300, effect: 'precision' },
        { baseId: 'double', name: '双倍', desc: '下次投掷奖励翻倍', price: 500, effect: 'double' },
        { baseId: 'lucky', name: '幸运', desc: '下次投掷更容易命中高分区域', price: 400, effect: 'lucky' },
        { baseId: 'multi', name: '三重', desc: '下次投掷同时射出3支飞镖', price: 800, effect: 'multi' },
        { baseId: 'quad', name: '四重', desc: '下次投掷同时射出4支飞镖', price: 1500, effect: 'quad' },
        { baseId: 'quint', name: '五重', desc: '下次投掷同时射出5支飞镖', price: 3000, effect: 'quint' },
        { baseId: 'triple_gold', name: '三倍', desc: '下次投掷奖励三倍', price: 1200, effect: 'triple' },
        { baseId: 'five_gold', name: '五倍', desc: '下次投掷奖励五倍', price: 3500, effect: 'fivex' },
        { baseId: 'perfect', name: '完美', desc: '下次投掷必定命中靶心', price: 2000, effect: 'perfect' },
        { baseId: 'auto', name: '自动', desc: '下次投掷自动瞄准最佳位置', price: 1000, effect: 'auto' },
        { baseId: 'magnet', name: '磁吸', desc: '飞镖会被靶心吸引', price: 600, effect: 'magnet' },
        { baseId: 'slow', name: '减速', desc: '飞镖飞行速度减慢，更容易控制', price: 250, effect: 'slow' },
        { baseId: 'piercing', name: '穿透', desc: '飞镖可穿透靶子，获得双倍机会', price: 1800, effect: 'piercing' },
        { baseId: 'bounce', name: '反弹', desc: '飞镖碰到边缘会反弹', price: 900, effect: 'bounce' },
        { baseId: 'explosion', name: '爆炸', desc: '命中后爆炸，影响周围区域', price: 2500, effect: 'explosion' },
        { baseId: 'freeze', name: '冻结', desc: '冻结靶子，下次投掷必中', price: 1600, effect: 'freeze' },
        { baseId: 'rage', name: '狂暴', desc: '攻击力提升，奖励+50%', price: 700, effect: 'rage' },
        { baseId: 'focus', name: '专注', desc: '精准度+30%', price: 450, effect: 'focus' },
        { baseId: 'vision', name: '鹰眼', desc: '显示最佳投掷位置', price: 800, effect: 'vision' },
        { baseId: 'blessing', name: '祝福', desc: '获得随机增益效果', price: 600, effect: 'blessing' }
    ];

    for (let i = 0; i < 5; i++) {
        for (const template of consumableTemplates) {
            const rarity = ['普通', '稀有', '史诗', '传说', '神话'][i];
            const multiplier = [1, 1.5, 2, 3, 5][i];
            const suffix = ['', '_rare', '_epic', '_legendary', '_mythic'][i];
            const effectMultiplier = [1, 1.5, 2, 3, 5][i];
            
            items[template.baseId + suffix] = {
                id: template.baseId + suffix,
                name: `${rarity}${template.name}`,
                icon: ['📦', '⭐', '💎', '👑', '🌟'][i],
                desc: template.desc + (i > 0 ? `（效果x${effectMultiplier}）` : ''),
                price: Math.floor(template.price * multiplier),
                type: 'consumable',
                effect: template.effect,
                rarity: rarity,
                effectMultiplier: effectMultiplier,
                category: 'consumable'
            };
        }
    }

    const permanentTemplates = [
        { baseId: 'perm_gold', name: '金币增幅器', desc: '永久提升金币获取+5%', price: 5000, stat: 'goldBonus', value: 5 },
        { baseId: 'perm_accuracy', name: '精准芯片', desc: '永久提升精准度+3%', price: 4000, stat: 'accuracyBonus', value: 3 },
        { baseId: 'perm_exp', name: '经验加成器', desc: '永久提升经验获取+10%', price: 6000, stat: 'expBonus', value: 10 },
        { baseId: 'perm_crit', name: '暴击模块', desc: '永久提升暴击率+2%', price: 8000, stat: 'critChance', value: 2 },
        { baseId: 'perm_crit_multi', name: '暴击伤害', desc: '永久提升暴击伤害+10%', price: 10000, stat: 'critMultiplier', value: 10 }
    ];

    for (let i = 0; i < 3; i++) {
        for (const template of permanentTemplates) {
            const tier = ['I', 'II', 'III'][i];
            const multiplier = [1, 3, 10][i];
            
            items[template.baseId + '_' + (i + 1)] = {
                id: template.baseId + '_' + (i + 1),
                name: `${template.name} ${tier}`,
                icon: ['🔧', '⚙️', '🔮'][i],
                desc: `${template.desc}（可叠加）`,
                price: Math.floor(template.price * multiplier),
                type: 'permanent',
                stat: template.stat,
                value: template.value * (i + 1),
                category: 'permanent'
            };
        }
    }

    for (const skinId in DART_SKINS) {
        const skin = DART_SKINS[skinId];
        if (skinId !== 'default') {
            items['skin_' + skinId] = {
                id: 'skin_' + skinId,
                name: skin.name + '皮肤',
                icon: skin.icon,
                desc: '解锁' + skin.name + '外观',
                price: skin.price,
                type: 'skin',
                skinId: skinId,
                category: 'skin'
            };
        }
    }

    return items;
}

const ITEMS = generateItems();

const LEVEL_TITLES = [
    { level: 1, title: '新手飞镖手', goldBonus: 0, accuracyBonus: 0 },
    { level: 5, title: '初级飞镖手', goldBonus: 3, accuracyBonus: 1 },
    { level: 10, title: '熟练飞镖手', goldBonus: 6, accuracyBonus: 2 },
    { level: 15, title: '精英飞镖手', goldBonus: 10, accuracyBonus: 4 },
    { level: 20, title: '大师飞镖手', goldBonus: 15, accuracyBonus: 6 },
    { level: 30, title: '传奇飞镖手', goldBonus: 22, accuracyBonus: 10 },
    { level: 40, title: '宗师飞镖手', goldBonus: 30, accuracyBonus: 14 },
    { level: 50, title: '神话飞镖手', goldBonus: 40, accuracyBonus: 18 },
    { level: 75, title: '至尊飞镖手', goldBonus: 55, accuracyBonus: 25 },
    { level: 100, title: '飞镖之神', goldBonus: 75, accuracyBonus: 35 }
];

function getLevelTitle(lvl) {
    let current = LEVEL_TITLES[0];
    for (const t of LEVEL_TITLES) {
        if (lvl >= t.level) current = t;
    }
    return current;
}

function getExpRequired(lvl) {
    return Math.floor(1000 * Math.pow(1.6, lvl - 1));
}

function getExpFromReward(reward, expBonus = 0) {
    const baseExp = Math.floor(reward / 5);
    const bonusMultiplier = 1 + expBonus / 100;
    return Math.floor(baseExp * bonusMultiplier);
}

function getGoldBonus(gameData) {
    const levelBonus = getLevelTitle(gameData.level).goldBonus;
    const permanentBonus = gameData.permanentStats ? gameData.permanentStats.goldBonus || 0 : 0;
    return levelBonus + permanentBonus;
}

function getAccuracyBonus(gameData) {
    const levelBonus = getLevelTitle(gameData.level).accuracyBonus;
    const permanentBonus = gameData.permanentStats ? gameData.permanentStats.accuracyBonus || 0 : 0;
    return levelBonus + permanentBonus;
}

function getExpBonus(gameData) {
    return gameData.permanentStats ? gameData.permanentStats.expBonus || 0 : 0;
}

function getCritChance(gameData) {
    return gameData.permanentStats ? gameData.permanentStats.critChance || 0 : 0;
}

function getCritMultiplier(gameData) {
    return gameData.permanentStats ? gameData.permanentStats.critMultiplier || 0 : 0;
}

function getLuckBonus(gameData) {
    return gameData.permanentStats ? gameData.permanentStats.luckBonus || 0 : 0;
}

function getComboBonus(gameData) {
    return gameData.permanentStats ? gameData.permanentStats.comboBonus || 0 : 0;
}

function getComboMultiplier(combo) {
    if (combo >= 20) return 3.0;
    if (combo >= 15) return 2.5;
    if (combo >= 10) return 2.0;
    if (combo >= 5) return 1.5;
    if (combo >= 3) return 1.2;
    return 1.0;
}

function shouldTriggerCrit(gameData) {
    const baseChance = getCritChance(gameData);
    const luckBonus = getLuckBonus(gameData);
    const totalChance = baseChance + luckBonus;
    return Math.random() * 100 < totalChance;
}

function updateTaskProgress(gameData, taskId, amount = 1) {
    if (!gameData.todayTasks) return;
    
    for (const task of gameData.todayTasks) {
        if (task.id === taskId && !task.completed) {
            task.progress += amount;
            if (task.progress >= task.target) {
                task.completed = true;
            }
        }
    }
}

function claimTaskReward(gameData, taskIndex) {
    const task = gameData.todayTasks[taskIndex];
    if (!task || !task.completed || task.claimed) return null;
    
    task.claimed = true;
    
    const reward = { ...task.reward };
    
    if (reward.type === 'gold') {
        gameData.money += reward.amount;
    } else if (reward.type === 'item') {
        gameData.inventory[reward.itemId] = (gameData.inventory[reward.itemId] || 0) + 1;
    } else if (reward.type === 'skin') {
        if (!gameData.unlockedSkins.includes(reward.skinId)) {
            gameData.unlockedSkins.push(reward.skinId);
        }
    }
    
    return reward;
}

const SKILLS = {
    aimLock: { name: '瞄准锁定', desc: '锁定瞄准指针3秒', cooldown: 15, upgradeCost: 1000, icon: '🎯' },
    timeSlow: { name: '时间减速', desc: '减慢指针速度50%持续5秒', cooldown: 20, upgradeCost: 1500, icon: '⏱️' },
    magnet: { name: '磁力吸引', desc: '飞镖自动吸附到最近的高分区域', cooldown: 25, upgradeCost: 2000, icon: '🧲' },
    powerThrow: { name: '强力投掷', desc: '本次投掷必定暴击', cooldown: 30, upgradeCost: 2500, icon: '💥' }
};

function useSkill(gameData, skillId) {
    const skill = gameData.skills[skillId];
    const skillConfig = SKILLS[skillId];
    if (!skill || skill.level === 0 || skill.cooldown > Date.now()) return false;
    
    skill.cooldown = Date.now() + skillConfig.cooldown * 1000;
    return true;
}

function getSkillCooldown(gameData, skillId) {
    const skill = gameData.skills[skillId];
    if (!skill || skill.level === 0) return null;
    const remaining = Math.max(0, skill.cooldown - Date.now());
    return Math.ceil(remaining / 1000);
}

function upgradeSkill(gameData, skillId) {
    const skill = gameData.skills[skillId];
    const skillConfig = SKILLS[skillId];
    if (!skill || skill.level >= 5) return false;
    
    const cost = skillConfig.upgradeCost * (skill.level + 1);
    if (gameData.money < cost) return false;
    
    gameData.money -= cost;
    skill.level++;
    return true;
}

const ACHIEVEMENTS = {
    first_blood: { name: '初露锋芒', desc: '完成第一次投掷', reward: { type: 'gold', amount: 100 }, icon: '🎯' },
    bullseye_master: { name: '靶心大师', desc: '命中靶心100次', target: 100, reward: { type: 'gold', amount: 5000 }, icon: '🎯' },
    combo_king: { name: '连击之王', desc: '达成50连击', target: 50, reward: { type: 'skin', skinId: 'golden' }, icon: '👑' },
    crit_master: { name: '暴击大师', desc: '触发100次暴击', target: 100, reward: { type: 'gold', amount: 3000 }, icon: '💥' },
    millionaire: { name: '百万富翁', desc: '累计赚取100万金币', target: 1000000, reward: { type: 'skin', skinId: 'rainbow' }, icon: '💰' },
    level_50: { name: '飞镖宗师', desc: '达到50级', target: 50, reward: { type: 'gold', amount: 10000 }, icon: '🏆' },
    perfect_10: { name: '十全十美', desc: '连续命中靶心10次', target: 10, reward: { type: 'item', itemId: 'perfect' }, icon: '⭐' },
    throw_1000: { name: '千次投掷', desc: '投掷1000次', target: 1000, reward: { type: 'gold', amount: 2000 }, icon: '📊' },
    speed_demon: { name: '速度恶魔', desc: '1分钟内投掷50次', target: 50, reward: { type: 'gold', amount: 1500 }, icon: '⚡' },
    treasure_hunter: { name: '寻宝猎人', desc: '开启所有飞镖皮肤', target: 25, reward: { type: 'gold', amount: 50000 }, icon: '🔮' }
};

function checkAchievements(gameData) {
    const unlocked = [];
    
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
        if (gameData.achievements[id]) continue;
        
        let unlockedAchievement = false;
        
        if (id === 'first_blood' && gameData.throws >= 1) unlockedAchievement = true;
        else if (id === 'bullseye_master' && gameData.totalBullseyes >= achievement.target) unlockedAchievement = true;
        else if (id === 'combo_king' && gameData.maxCombo >= achievement.target) unlockedAchievement = true;
        else if (id === 'crit_master' && gameData.totalCrits >= achievement.target) unlockedAchievement = true;
        else if (id === 'millionaire' && gameData.totalEarned >= achievement.target) unlockedAchievement = true;
        else if (id === 'level_50' && gameData.level >= achievement.target) unlockedAchievement = true;
        else if (id === 'perfect_10' && gameData.maxConsecutiveHits >= achievement.target) unlockedAchievement = true;
        else if (id === 'throw_1000' && gameData.throws >= achievement.target) unlockedAchievement = true;
        else if (id === 'treasure_hunter' && gameData.unlockedSkins.length >= achievement.target) unlockedAchievement = true;
        
        if (unlockedAchievement) {
            gameData.achievements[id] = true;
            unlocked.push(id);
            
            if (achievement.reward.type === 'gold') {
                gameData.money += achievement.reward.amount;
            } else if (achievement.reward.type === 'item') {
                gameData.inventory[achievement.reward.itemId] = (gameData.inventory[achievement.reward.itemId] || 0) + 1;
            } else if (achievement.reward.type === 'skin') {
                if (!gameData.unlockedSkins.includes(achievement.reward.skinId)) {
                    gameData.unlockedSkins.push(achievement.reward.skinId);
                }
            }
        }
    }
    
    return unlocked;
}

function calculateOfflineEarnings(gameData) {
    const now = Date.now();
    const lastTime = gameData.lastOnlineTime || now;
    const offlineMinutes = Math.floor((now - lastTime) / 60000);
    
    if (offlineMinutes < 5) return 0;
    
    const maxOfflineHours = 8;
    const effectiveMinutes = Math.min(offlineMinutes, maxOfflineHours * 60);
    
    const baseEarning = gameData.level * 2;
    const goldBonus = 1 + (getGoldBonus(gameData) / 100);
    const totalEarnings = Math.floor(effectiveMinutes * baseEarning * goldBonus);
    
    return totalEarnings;
}

function claimOfflineEarnings(gameData) {
    const earnings = calculateOfflineEarnings(gameData);
    if (earnings > 0) {
        gameData.money += earnings;
        gameData.offlineEarnings += earnings;
        gameData.lastOnlineTime = Date.now();
    }
    return earnings;
}

const CRAFTING_RECIPES = {
    super_precision: { name: '超级精准', desc: '精准度+50%', ingredients: { precision: 3, lucky: 2 }, result: { type: 'effect', effect: 'super_precision', duration: 5 }, icon: '✨' },
    multi_double: { name: '多重双倍', desc: '3支飞镖+双倍奖励', ingredients: { multi: 2, double: 2 }, result: { type: 'effect', effect: 'multi_double', duration: 3 }, icon: '🌟' },
    perfect_triple: { name: '完美三倍', desc: '必中靶心+三倍奖励', ingredients: { perfect: 2, triple: 2 }, result: { type: 'effect', effect: 'perfect_triple', duration: 2 }, icon: '👑' },
    crit_machine: { name: '暴击机器', desc: '暴击率+100%', ingredients: { triple: 3, lucky: 3 }, result: { type: 'effect', effect: 'crit_machine', duration: 5 }, icon: '⚡' },
    gold_rush: { name: '淘金热', desc: '金币奖励+200%', ingredients: { double: 3, fivex: 1 }, result: { type: 'effect', effect: 'gold_rush', duration: 10 }, icon: '💰' }
};

function canCraft(gameData, recipeId) {
    const recipe = CRAFTING_RECIPES[recipeId];
    if (!recipe) return false;
    
    for (const [itemId, count] of Object.entries(recipe.ingredients)) {
        if ((gameData.inventory[itemId] || 0) < count) return false;
    }
    
    return true;
}

function craftItem(gameData, recipeId) {
    if (!canCraft(gameData, recipeId)) return false;
    
    const recipe = CRAFTING_RECIPES[recipeId];
    
    for (const [itemId, count] of Object.entries(recipe.ingredients)) {
        gameData.inventory[itemId] -= count;
        if (gameData.inventory[itemId] <= 0) {
            delete gameData.inventory[itemId];
        }
    }
    
    if (recipe.result.type === 'effect') {
        gameData.activeEffects[recipe.result.effect] = (gameData.activeEffects[recipe.result.effect] || 0) + recipe.result.duration;
    }
    
    return true;
}

const CHALLENGES = {
    challenge_1: { name: '新手挑战', desc: '在1分钟内赚取500金币', target: 500, timeLimit: 60, reward: { type: 'gold', amount: 200 }, icon: '🎯' },
    challenge_2: { name: '精准挑战', desc: '连续命中靶心5次', target: 5, timeLimit: 120, reward: { type: 'item', itemId: 'perfect' }, icon: '🎯' },
    challenge_3: { name: '连击挑战', desc: '达成20连击', target: 20, timeLimit: 180, reward: { type: 'gold', amount: 1000 }, icon: '🔥' },
    challenge_4: { name: '暴击挑战', desc: '触发10次暴击', target: 10, timeLimit: 180, reward: { type: 'item', itemId: 'triple' }, icon: '💥' },
    challenge_5: { name: '极速挑战', desc: '30秒内投掷20次', target: 20, timeLimit: 30, reward: { type: 'gold', amount: 500 }, icon: '⚡' },
    challenge_6: { name: '百万挑战', desc: '一局赚取10000金币', target: 10000, timeLimit: 300, reward: { type: 'skin', skinId: 'star' }, icon: '⭐' },
    challenge_7: { name: '大师挑战', desc: '命中靶心20次', target: 20, timeLimit: 300, reward: { type: 'gold', amount: 5000 }, icon: '🏆' },
    challenge_8: { name: '传奇挑战', desc: '达成50连击', target: 50, timeLimit: 600, reward: { type: 'skin', skinId: 'galaxy' }, icon: '🌌' }
};

function startChallenge(gameData, challengeId) {
    if (gameData.currentChallenge) return false;
    if (gameData.completedChallenges.includes(challengeId)) return false;
    
    gameData.currentChallenge = challengeId;
    gameData.challengeProgress = 0;
    gameData.challengeStartTime = Date.now();
    
    return true;
}

function completeChallenge(gameData) {
    if (!gameData.currentChallenge) return false;
    
    const challenge = CHALLENGES[gameData.currentChallenge];
    if (!challenge) return false;
    
    const reward = challenge.reward;
    
    if (reward.type === 'gold') {
        gameData.money += reward.amount;
    } else if (reward.type === 'item') {
        gameData.inventory[reward.itemId] = (gameData.inventory[reward.itemId] || 0) + 1;
    } else if (reward.type === 'skin') {
        if (!gameData.unlockedSkins.includes(reward.skinId)) {
            gameData.unlockedSkins.push(reward.skinId);
        }
    }
    
    gameData.completedChallenges.push(gameData.currentChallenge);
    gameData.currentChallenge = null;
    gameData.challengeProgress = 0;
    
    return true;
}

function updateChallengeProgress(gameData, type, amount = 1) {
    if (!gameData.currentChallenge) return;
    
    const challenge = CHALLENGES[gameData.currentChallenge];
    if (!challenge) return;
    
    const timeRemaining = challenge.timeLimit - Math.floor((Date.now() - gameData.challengeStartTime) / 1000);
    if (timeRemaining <= 0) {
        gameData.currentChallenge = null;
        gameData.challengeProgress = 0;
        return;
    }
    
    if (type === 'gold') {
        gameData.challengeProgress += amount;
    } else if (type === 'bullseye') {
        if (amount > 0) gameData.challengeProgress++;
    } else if (type === 'combo') {
        gameData.challengeProgress = Math.max(gameData.challengeProgress, amount);
    } else if (type === 'crit') {
        if (amount > 0) gameData.challengeProgress++;
    } else if (type === 'throw') {
        gameData.challengeProgress++;
    }
    
    if (gameData.challengeProgress >= challenge.target) {
        completeChallenge(gameData);
    }
}

const THEMES = {
    light: { name: '白色', bg: '#ffffff', accent: '#3b82f6' },
    dark: { name: '暗黑', bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', accent: '#00d4ff' },
    neon: { name: '霓虹', bg: 'linear-gradient(135deg, #2d0f3d 0%, #1a0f2e 50%, #0d0f20 100%)', accent: '#ff00ff' },
    ocean: { name: '海洋', bg: 'linear-gradient(135deg, #0c1929 0%, #1b3a4b 50%, #2c5f7c 100%)', accent: '#00d4ff' },
    fire: { name: '烈焰', bg: 'linear-gradient(135deg, #2d0a0a 0%, #4a1a1a 50%, #6b2a2a 100%)', accent: '#ff4500' },
    forest: { name: '森林', bg: 'linear-gradient(135deg, #0a1a0a 0%, #1a3a1a 50%, #2a5a2a 100%)', accent: '#00ff00' },
    sunset: { name: '日落', bg: 'linear-gradient(135deg, #2d1a0a 0%, #4a2a1a 50%, #6b3a2a 100%)', accent: '#ff8c00' }
};

function setTheme(gameData, themeId) {
    if (!THEMES[themeId]) return false;
    gameData.currentTheme = themeId;
    return true;
}

function addToLeaderboard(gameData, score) {
    gameData.leaderboard.push({ score, date: new Date().toDateString(), level: gameData.level });
    gameData.leaderboard.sort((a, b) => b.score - a.score);
    gameData.leaderboard = gameData.leaderboard.slice(0, 10);
}

function getLeaderboard(gameData) {
    return gameData.leaderboard || [];
}

const CHECKIN_REWARDS = [
    { day: 1, reward: { type: 'gold', amount: 100 }, icon: '💰' },
    { day: 2, reward: { type: 'gold', amount: 200 }, icon: '💰' },
    { day: 3, reward: { type: 'item', itemId: 'precision' }, icon: '🎯' },
    { day: 4, reward: { type: 'gold', amount: 300 }, icon: '💰' },
    { day: 5, reward: { type: 'item', itemId: 'double' }, icon: '✨' },
    { day: 6, reward: { type: 'gold', amount: 500 }, icon: '💰' },
    { day: 7, reward: { type: 'skin', skinId: 'golden' }, icon: '👑' }
];

function checkIn(gameData) {
    const today = new Date().toDateString();
    if (gameData.lastCheckInDate === today) return null;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (gameData.lastCheckInDate !== yesterday.toDateString()) {
        gameData.checkInDays = 1;
    } else {
        gameData.checkInDays++;
    }
    
    gameData.lastCheckInDate = today;
    
    const dayIndex = (gameData.checkInDays - 1) % CHECKIN_REWARDS.length;
    const reward = CHECKIN_REWARDS[dayIndex];
    
    if (reward.reward.type === 'gold') {
        gameData.money += reward.reward.amount;
    } else if (reward.reward.type === 'item') {
        gameData.inventory[reward.reward.itemId] = (gameData.inventory[reward.reward.itemId] || 0) + 1;
    } else if (reward.reward.type === 'skin') {
        if (!gameData.unlockedSkins.includes(reward.reward.skinId)) {
            gameData.unlockedSkins.push(reward.reward.skinId);
        }
    }
    
    return { ...reward, actualDay: gameData.checkInDays };
}

function canCheckIn(gameData) {
    const today = new Date().toDateString();
    return gameData.lastCheckInDate !== today;
}

const RANDOM_EVENTS = [
    { id: 'lucky_drop', name: '幸运掉落', desc: '获得双倍金币持续3次投掷', effect: { type: 'effect', effect: 'double', duration: 3 }, icon: '🍀', chance: 0.05 },
    { id: 'mystery_merchant', name: '神秘商人', desc: '购买道具半价持续1分钟', effect: { type: 'buff', buff: 'discount_50', duration: 60 }, icon: '🏪', chance: 0.03 },
    { id: 'treasure_chest', name: '宝箱发现', desc: '直接获得500金币', effect: { type: 'gold', amount: 500 }, icon: '📦', chance: 0.04 },
    { id: 'skill_refresh', name: '技能重置', desc: '所有技能冷却立即重置', effect: { type: 'skill_reset' }, icon: '🔄', chance: 0.02 },
    { id: 'exp_boost', name: '经验加倍', desc: '获得双倍经验持续5次投掷', effect: { type: 'effect', effect: 'exp_double', duration: 5 }, icon: '📚', chance: 0.03 },
    { id: 'crit_frenzy', name: '暴击狂潮', desc: '暴击率提升100%持续3次投掷', effect: { type: 'effect', effect: 'crit_up', duration: 3 }, icon: '💥', chance: 0.02 },
    { id: 'magnet_field', name: '磁场干扰', desc: '飞镖更容易命中高分区域', effect: { type: 'effect', effect: 'magnet', duration: 5 }, icon: '🧲', chance: 0.04 },
    { id: 'lucky_day', name: '幸运日', desc: '获得随机稀有道具', effect: { type: 'item', itemId: 'perfect' }, icon: '⭐', chance: 0.01 }
];

function triggerRandomEvent(gameData) {
    if (Date.now() < gameData.randomEventCooldown) return null;
    
    const availableEvents = RANDOM_EVENTS.filter(e => Math.random() < e.chance);
    if (availableEvents.length === 0) return null;
    
    const event = availableEvents[Math.floor(Math.random() * availableEvents.length)];
    gameData.dailyRandomEvent = event.id;
    gameData.randomEventCooldown = Date.now() + 300000;
    
    if (event.effect.type === 'gold') {
        gameData.money += event.effect.amount;
    } else if (event.effect.type === 'item') {
        gameData.inventory[event.effect.itemId] = (gameData.inventory[event.effect.itemId] || 0) + 1;
    } else if (event.effect.type === 'effect') {
        gameData.activeEffects[event.effect.effect] = (gameData.activeEffects[event.effect.effect] || 0) + event.effect.duration;
    } else if (event.effect.type === 'skill_reset') {
        for (const skill of Object.values(gameData.skills)) {
            skill.cooldown = 0;
        }
    }
    
    return event;
}

const EVENTS = {
    event_doubles: { 
        id: 'event_doubles', name: '双倍周末', desc: '周末期间所有金币奖励翻倍', 
        startDate: new Date(new Date().setDate(new Date().getDate() + (6 - new Date().getDay()) % 7)),
        endDate: new Date(new Date().setDate(new Date().getDate() + (7 - new Date().getDay()) % 7)),
        multiplier: 2, icon: '🎊' 
    },
    event_bonus: { 
        id: 'event_bonus', name: '经验狂欢', desc: '获得150%经验值', 
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        expMultiplier: 1.5, icon: '📚' 
    },
    event_crit: { 
        id: 'event_crit', name: '暴击周', desc: '暴击率提升50%', 
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
        critBonus: 50, icon: '💥' 
    }
};

function getActiveEvent(gameData) {
    const now = Date.now();
    for (const event of Object.values(EVENTS)) {
        if (now >= event.startDate.getTime() && now <= event.endDate.getTime()) {
            gameData.currentEvent = event.id;
            return event;
        }
    }
    gameData.currentEvent = null;
    return null;
}

const SEASON_REWARDS = [
    { level: 1, reward: { type: 'gold', amount: 500 }, icon: '💰', free: true },
    { level: 2, reward: { type: 'item', itemId: 'precision' }, icon: '🎯', free: true },
    { level: 3, reward: { type: 'gold', amount: 1000 }, icon: '💰', free: true },
    { level: 4, reward: { type: 'item', itemId: 'double' }, icon: '✨', free: true },
    { level: 5, reward: { type: 'gold', amount: 2000 }, icon: '💰', free: true },
    { level: 6, reward: { type: 'skin', skinId: 'crystal' }, icon: '💎', free: false },
    { level: 7, reward: { type: 'gold', amount: 3000 }, icon: '💰', free: true },
    { level: 8, reward: { type: 'item', itemId: 'triple' }, icon: '🌟', free: true },
    { level: 9, reward: { type: 'gold', amount: 5000 }, icon: '💰', free: true },
    { level: 10, reward: { type: 'skin', skinId: 'rainbow' }, icon: '🌈', free: false },
    { level: 11, reward: { type: 'gold', amount: 8000 }, icon: '💰', free: true },
    { level: 12, reward: { type: 'item', itemId: 'perfect' }, icon: '👑', free: true },
    { level: 13, reward: { type: 'gold', amount: 10000 }, icon: '💰', free: true },
    { level: 14, reward: { type: 'item', itemId: 'fivex' }, icon: '💥', free: true },
    { level: 15, reward: { type: 'skin', skinId: 'galaxy' }, icon: '🌌', free: false }
];

function getSeasonExpRequired(level) {
    return Math.floor(500 * Math.pow(1.2, level - 1));
}

function addSeasonExp(gameData, exp) {
    gameData.seasonExp += exp;
    const expToNext = getSeasonExpRequired(gameData.seasonLevel);
    
    while (gameData.seasonExp >= expToNext) {
        gameData.seasonExp -= expToNext;
        gameData.seasonLevel++;
    }
}

function claimSeasonReward(gameData, level) {
    const reward = SEASON_REWARDS.find(r => r.level === level);
    if (!reward) return null;
    if (gameData.seasonRewards.includes(level)) return null;
    if (!reward.free && gameData.seasonPass !== 'premium') return null;
    
    gameData.seasonRewards.push(level);
    
    if (reward.reward.type === 'gold') {
        gameData.money += reward.reward.amount;
    } else if (reward.reward.type === 'item') {
        gameData.inventory[reward.reward.itemId] = (gameData.inventory[reward.reward.itemId] || 0) + 1;
    } else if (reward.reward.type === 'skin') {
        if (!gameData.unlockedSkins.includes(reward.reward.skinId)) {
            gameData.unlockedSkins.push(reward.reward.skinId);
        }
    }
    
    return reward;
}

function buySeasonPass(gameData) {
    const cost = 5000;
    if (gameData.money < cost) return false;
    gameData.money -= cost;
    gameData.seasonPass = 'premium';
    return true;
}

// ===================== 飞镖工坊 =====================

const DART_MATERIALS = {
    wood:     { name: '木质',   color: '#8B4513', bonus: { goldBonus: 0,  accuracyBonus: 0,  critChance: 0  }, cost: 0,     icon: '🪵' },
    iron:     { name: '铁质',   color: '#C0C0C0', bonus: { goldBonus: 5,  accuracyBonus: 3,  critChance: 2  }, cost: 500,   icon: '⚙️' },
    steel:    { name: '钢质',   color: '#B0B0B0', bonus: { goldBonus: 10, accuracyBonus: 5,  critChance: 5  }, cost: 2000,  icon: '🔩' },
    titanium: { name: '钛合金', color: '#D0D0FF', bonus: { goldBonus: 15, accuracyBonus: 10, critChance: 8  }, cost: 5000,  icon: '✨' },
    diamond:  { name: '钻石',   color: '#B9F2FF', bonus: { goldBonus: 25, accuracyBonus: 15, critChance: 15 }, cost: 15000, icon: '💎' }
};

const DART_SHAPES = {
    standard: { name: '标准型',   desc: '平衡型，无特殊效果',           cost: 0,     icon: '🎯' },
    sharp:    { name: '尖锐型',   desc: '精准度+10%',                   cost: 1000,  icon: '🔪' },
    wide:     { name: '宽刃型',   desc: '金币奖励+10%',                 cost: 1000,  icon: '⚔️' },
    spiral:   { name: '螺旋型',   desc: '暴击率+5%',                    cost: 2000,  icon: '🌀' },
            star:     { name: '星型',     desc: '所有属性+5%',                  cost: 5000,  icon: '⭐' }
};

const DART_COLORS = {
    red:    { name: '红色',  color: '#FF4444', cost: 0,    icon: '🔴' },
    blue:   { name: '蓝色',  color: '#4444FF', cost: 0,    icon: '🔵' },
    green:  { name: '绿色',  color: '#44FF44', cost: 0,    icon: '🟢' },
    purple: { name: '紫色',  color: '#AA44FF', cost: 200,  icon: '🟣' },
    gold:   { name: '金色',  color: '#FFD700', cost: 500,  icon: '🟡' },
    rainbow:{ name: '彩虹',  color: 'rainbow', cost: 3000, icon: '🌈' }
};

function craftCustomDart(gameData, name, material, shape, color) {
    const mat = DART_MATERIALS[material];
    const shp = DART_SHAPES[shape];
    const clr = DART_COLORS[color];
    
    if (!mat || !shp || !clr) return { success: false, msg: '参数无效' };
    
    const totalCost = mat.cost + shp.cost + clr.cost;
    if (gameData.money < totalCost) return { success: false, msg: '金币不足' };
    
    gameData.money -= totalCost;
    
    const customDart = {
        id: 'custom_' + Date.now(),
        name: name || '自定义飞镖',
        material, shape, color,
        bonus: { ...mat.bonus },
        createdAt: Date.now()
    };
    
    if (shape === 'sharp')    customDart.bonus.accuracyBonus += 10;
    if (shape === 'wide')     customDart.bonus.goldBonus += 10;
    if (shape === 'spiral')   customDart.bonus.critChance += 5;
    if (shape === 'star') {
        customDart.bonus.goldBonus += 5;
        customDart.bonus.accuracyBonus += 5;
        customDart.bonus.critChance += 5;
    }
    
    gameData.customDarts.push(customDart);
    return { success: true, msg: '制作成功', dart: customDart };
}

function equipCustomDart(gameData, dartId) {
    const dart = gameData.customDarts.find(d => d.id === dartId);
    if (!dart) return false;
    
    gameData.currentSkin = 'custom';
    gameData.equippedCustomDart = dartId;
    
    if (!gameData.permanentStats) gameData.permanentStats = {};
    
    return true;
}

function getCustomDartBonus(gameData) {
    if (gameData.currentSkin !== 'custom' || !gameData.equippedCustomDart) return null;
    const dart = gameData.customDarts.find(d => d.id === gameData.equippedCustomDart);
    return dart ? dart.bonus : null;
}

// ===================== 限时商店 =====================

const LIMITED_SHOP_POOL = [
    { itemId: 'precision',  discount: 50, icon: '🎯' },
    { itemId: 'double',     discount: 40, icon: '✨' },
    { itemId: 'triple',     discount: 30, icon: '🌟' },
    { itemId: 'lucky',      discount: 50, icon: '🍀' },
    { itemId: 'multi',      discount: 35, icon: '🎯' },
    { itemId: 'perfect',    discount: 20, icon: '👑' },
    { itemId: 'fivex',      discount: 25, icon: '💥' },
    { itemId: 'quad',       discount: 30, icon: '🔥' },
    { itemId: 'quint',      discount: 20, icon: '⚡' },
    { itemId: 'auto',       discount: 40, icon: '🤖' }
];

function refreshLimitedShop(gameData) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (now - gameData.limitedShopLastRefresh < oneDay && gameData.limitedShopItems.length > 0) {
        return gameData.limitedShopItems;
    }
    
    gameData.limitedShopLastRefresh = now;
    
    const shuffled = [...LIMITED_SHOP_POOL].sort(() => Math.random() - 0.5);
    gameData.limitedShopItems = shuffled.slice(0, 4).map(item => {
        const baseItem = ITEMS[item.itemId];
        if (!baseItem) return null;
        return {
            ...item,
            originalPrice: baseItem.price,
            discountedPrice: Math.floor(baseItem.price * (1 - item.discount / 100))
        };
    }).filter(Boolean);
    
    return gameData.limitedShopItems;
}

function buyLimitedItem(gameData, itemId) {
    const item = gameData.limitedShopItems.find(i => i.itemId === itemId);
    if (!item) return { success: false, msg: '商品不存在' };
    
    if (gameData.money < item.discountedPrice) return { success: false, msg: '金币不足' };
    
    gameData.money -= item.discountedPrice;
    gameData.inventory[itemId] = (gameData.inventory[itemId] || 0) + 1;
    
    return { success: true, msg: '购买成功' };
}
