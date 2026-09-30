const zeroWidthRect = ({ x, y }) => new DOMRect(x, y, 0, 0);

export const getSelectionPointRects = (selection, mousePosition) => {
  const range = selection.getRangeAt(0);
  const rects = [...range.getClientRects()];

  if (rects.length === 0) {
    const fallback = mousePosition ? zeroWidthRect(mousePosition) : null;
    return { start: fallback, end: fallback };
  }

  return {
    start: rects[0],
    end: rects[rects.length - 1],
  };
};

export const getSelectionStartPointRect = (s, m) =>
  getSelectionPointRects(s, m).start;

export const getSelectionEndPointRect = (s, m) =>
  getSelectionPointRects(s, m).end;

export const clearSelection = () => {
  document.getSelection()?.removeAllRanges();
};

const distance = (pointA, pointB) => {
  return Math.sqrt(
    Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2),
  );
};

// 弹出元素与选区的间距
export const SELECTION_GAP = 8;
// 弹出元素与视口边缘的最小间距
const VIEWPORT_MARGIN = 10;
// 未传入 minHeight 时的默认最小可用高度
const MIN_USABLE_HEIGHT = 120;

/**
 * 计算弹出元素的位置
 * @param {HTMLElement} showElement 弹出元素
 * @param {Object} selectActionInfo 选择动作信息
 * @param {Object} [options]
 * @param {number} [options.minHeight] 弹出元素可接受的最小高度，所在一侧放不下时改用整个视口高度
 * @returns {{ x: number, y: number, maxHeight: number }} 弹出元素的位置，以及所在一侧可容纳的最大高度
 */
export const calculateShowPosition = (
  showElement,
  selectActionInfo,
  { minHeight = MIN_USABLE_HEIGHT } = {},
) => {
  const { selection, mousePosition } = selectActionInfo;
  const { start: startPointRect, end: endPointRect } = getSelectionPointRects(
    selection,
    mousePosition,
  );

  // 默认对齐选区首行左侧
  // *选区首行左侧不一定是选区段落左侧，例如从某行中间开始，从左往右，自上到下开始选
  let x = startPointRect.left;
  // 默认在选区文字下方弹出
  let placeAbove = false;

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const style = getComputedStyle(showElement);
  const showElementWidth = parseInt(style.width) || 32;
  const showElementHeight = parseInt(style.height) || 32;

  // 选区首行左上角
  const topLeft = { x: startPointRect.left, y: startPointRect.top };
  // 选区末行右下角
  // *该位置不一定对齐选区段落右侧，例如选中多行时，最后一行只选了一部分
  const bottomRight = { x: endPointRect.right, y: endPointRect.bottom };

  // 使得弹出位置贴近鼠标释放点（不超过选区文字范围）
  if (
    distance(topLeft, mousePosition) <= distance(bottomRight, mousePosition)
  ) {
    x = topLeft.x;

    // 选中多行，且鼠标释放点接近选区首行左上角时，优先在选区上方弹出
    placeAbove = endPointRect.bottom > startPointRect.bottom;
  } else {
    x = bottomRight.x - showElementWidth;
  }

  // 弹出位置 x 轴坐标不超过视口宽度
  if (x + showElementWidth > viewportWidth) {
    x = viewportWidth - showElementWidth - VIEWPORT_MARGIN;
  }

  // 弹出位置 x 轴坐标最小值为 10px, 与视口左边缘保持一定间距
  if (x < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN;

  const spaceAbove = startPointRect.top - SELECTION_GAP - VIEWPORT_MARGIN;
  const spaceBelow =
    viewportHeight - endPointRect.bottom - SELECTION_GAP - VIEWPORT_MARGIN;
  const fits = (above) =>
    showElementHeight <= (above ? spaceAbove : spaceBelow);

  // 优先侧放不下时换到另一侧；两侧都放不下时选空间更大的一侧
  if (!fits(placeAbove)) {
    placeAbove = fits(!placeAbove) ? !placeAbove : spaceAbove > spaceBelow;
  }

  let maxHeight = placeAbove ? spaceAbove : spaceBelow;
  // 内容本身比最小高度还矮时，按内容高度判断即可
  if (maxHeight < Math.min(minHeight, showElementHeight)) {
    maxHeight = viewportHeight - VIEWPORT_MARGIN * 2;
  }

  const height = Math.min(showElementHeight, maxHeight);
  let y = placeAbove
    ? startPointRect.top - SELECTION_GAP - height
    : endPointRect.bottom + SELECTION_GAP;

  // 所有调整完成后再统一限制在视口内
  y = Math.max(
    VIEWPORT_MARGIN,
    Math.min(y, viewportHeight - height - VIEWPORT_MARGIN),
  );

  return { x, y, maxHeight };
};
