export const createShadowHost = ({ id, html }) => {
  const host = document.createElement('div');
  host.id = id;
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = html;

  // 清理旧的节点，防止插件更新后，chrome 在已打开标签页再次注入 DOM 时，新旧节点同时存在
  document.getElementById(id)?.remove();

  document.documentElement.appendChild(host);
  return {
    host,
    shadow,
  };
};
