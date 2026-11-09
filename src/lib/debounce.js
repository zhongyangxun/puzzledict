export function debounce(func, wait, immediate = false) {
  let timer = null;

  function debounced(...args) {
    clearTimeout(timer);

    if (immediate && timer === null) {
      func.apply(this, args);
    }

    timer = setTimeout(() => {
      if (!immediate) {
        func.apply(this, args);
      }

      timer = null;
    }, wait);
  }

  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
