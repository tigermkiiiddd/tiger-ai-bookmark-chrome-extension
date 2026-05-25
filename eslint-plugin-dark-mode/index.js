/**
 * ESLint 插件：检查 Tailwind CSS 深色模式适配
 * 检测 className 中缺少 dark: 变体的浅色颜色类名
 */

const LIGHT_COLORS_REQUIRING_DARK = [
  // 背景色
  { pattern: /\bbg-white\b/, darkHint: 'dark:bg-gray-800 或 dark:bg-gray-900' },
  { pattern: /\bbg-gray-50\b/, darkHint: 'dark:bg-gray-900' },
  { pattern: /\bbg-gray-100\b/, darkHint: 'dark:bg-gray-800' },
  { pattern: /\bbg-gray-200\b/, darkHint: 'dark:bg-gray-700' },
  { pattern: /\bbg-gray-300\b/, darkHint: 'dark:bg-gray-600' },
  // 文字色
  { pattern: /\btext-gray-900\b/, darkHint: 'dark:text-gray-100' },
  { pattern: /\btext-gray-800\b/, darkHint: 'dark:text-gray-200' },
  { pattern: /\btext-gray-700\b/, darkHint: 'dark:text-gray-300' },
  { pattern: /\btext-gray-600\b/, darkHint: 'dark:text-gray-400' },
  // 边框色
  { pattern: /\bborder-gray-200\b/, darkHint: 'dark:border-gray-700' },
  { pattern: /\bborder-gray-300\b/, darkHint: 'dark:border-gray-600' },
  // hover 背景
  { pattern: /\bhover:bg-gray-50\b/, darkHint: 'dark:hover:bg-gray-800' },
  { pattern: /\bhover:bg-gray-100\b/, darkHint: 'dark:hover:bg-gray-700' },
  { pattern: /\bhover:bg-gray-200\b/, darkHint: 'dark:hover:bg-gray-600' },
  // 遮罩
  { pattern: /\bbg-black\s+bg-opacity-\d+\b/, darkHint: 'dark:bg-gray-900 dark:bg-opacity-80' },
];

/** 判断一段 className 文本是否已有任何 dark: 前缀 */
function hasAnyDarkPrefix(classText) {
  return /\bdark:/.test(classText);
}

/** 从 JSX 属性值中提取原始文本 */
function extractClassText(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    // 简单处理：拼接静态部分和表达式占位
    let text = '';
    for (let i = 0; i < node.quasis.length; i++) {
      text += node.quasis[i].value.raw;
      if (i < node.expressions.length) {
        text += '${...}';
      }
    }
    return text;
  }

  if (node.type === 'JSXExpressionContainer' && node.expression) {
    const expr = node.expression;
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    if (expr.type === 'TemplateLiteral') {
      return extractClassText(expr);
    }
    // 复杂表达式无法静态分析，跳过
    return null;
  }

  return null;
}

/** 检查类名文本中是否包含某个浅色类且缺少对应 dark: */
function findMissingDarkClasses(classText) {
  if (!classText || typeof classText !== 'string') return [];

  const missing = [];
  for (const { pattern, darkHint } of LIGHT_COLORS_REQUIRING_DARK) {
    if (pattern.test(classText)) {
      // 如果同一段文本里已经有 dark: 前缀，认为已适配（简化处理）
      if (!hasAnyDarkPrefix(classText)) {
        const match = classText.match(pattern);
        missing.push({
          className: match[0],
          darkHint,
        });
      }
    }
  }
  return missing;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '检查 Tailwind CSS 深色模式适配是否完整',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      missingDarkMode:
        "颜色 '{{className}}' 缺少深色模式适配，建议添加 {{darkHint}}",
    },
  },

  create(context) {
    return {
      // className="..."
      JSXAttribute(node) {
        if (node.name?.name !== 'className') return;
        if (!node.value) return;

        const classText = extractClassText(node.value);
        if (!classText) return;

        const missing = findMissingDarkClasses(classText);
        for (const item of missing) {
          context.report({
            node,
            messageId: 'missingDarkMode',
            data: item,
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'require-dark-mode': rule,
  },
};
