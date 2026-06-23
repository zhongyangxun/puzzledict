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

/**
 * 计算弹出元素的位置
 * @param {HTMLElement} showElement 弹出元素
 * @param {Object} selectActionInfo 选择动作信息
 * @returns {Object} 弹出元素的位置
 */
export const calculateShowPosition = (showElement, selectActionInfo) => {
  const { selection, mousePosition } = selectActionInfo;
  const { start: startPointRect, end: endPointRect } = getSelectionPointRects(
    selection,
    mousePosition,
  );

  // 默认对齐选区首行左侧
  // *选区首行左侧不一定是选区段落左侧，例如从某行中间开始，从左往右，自上到下开始选
  let x = startPointRect.left;
  // 默认在选区文字下方弹出
  let y = endPointRect.bottom + 8;

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

    // 选中多行，且鼠标释放点接近选区首行左上角时，将弹出位置 y 轴坐标调整到选区上方
    const selectedMultiLines = endPointRect.bottom > startPointRect.bottom;
    selectedMultiLines && (y = topLeft.y - showElementHeight - 8);
  } else {
    x = bottomRight.x - showElementWidth;
  }

  // 弹出位置 x 轴坐标不超过视口宽度
  if (x + showElementWidth > viewportWidth) {
    x = viewportWidth - showElementWidth - 10;
  }

  // 弹出位置 x 轴坐标最小值为 10px, 与视口左边缘保持一定间距
  if (x < 10) x = 10;

  // 弹出位置 y 轴坐标最小值为 10px, 与视口顶部保持一定间距
  if (y < 10) y = 10;

  // 选区下方视口剩余高度无法容纳弹出元素时，将弹出位置 y 轴调整到选区上方
  if (y + showElementHeight > viewportHeight) {
    y = startPointRect.top - showElementHeight - 8;
  }

  return { x, y };
};
