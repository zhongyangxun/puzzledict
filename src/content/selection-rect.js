export const getSelectionClientRect = (selection, mouseEvent) => {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const { width, height } = rect;

  if (width === 0 && height === 0) {
    // 用鼠标释放位置作为锚点，构造一个零宽矩形
    return new DOMRect(mouseEvent.clientX, mouseEvent.clientY, 0, 0);
  }

  return rect;
};

export const clearSelection = () => {
  document.getSelection()?.removeAllRanges();
};
