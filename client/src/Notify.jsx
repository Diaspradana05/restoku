import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useNotify = () => useContext(Ctx);

const ICON = { success: '✓', error: '✕', info: 'ℹ' };

export function NotifyProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { kind:'confirm'|'ask', title, message, danger, placeholder, resolve }
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({ kind: 'confirm', message, resolve, ...opts });
  }), []);
  const ask = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({ kind: 'ask', message, resolve, value: opts.defaultValue || '', ...opts });
  }), []);

  const close = (result) => { dialog?.resolve(result); setDialog(null); };

  return (
    <Ctx.Provider value={{ toast, success: (m) => toast(m, 'success'), error: (m) => toast(m, 'error'), confirm, ask }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className={`toast toast-${t.type}`} key={t.id}>
            <span className="toast-icon">{ICON[t.type]}</span>
            <span>{t.message}</span>
            <button className="toast-x" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="overlay" onClick={() => close(dialog.kind === 'confirm' ? false : null)}>
          <form
            className="card dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); close(dialog.kind === 'confirm' ? true : dialog.value); }}
          >
            {dialog.title && <h3>{dialog.title}</h3>}
            <p>{dialog.message}</p>
            {dialog.kind === 'ask' && (
              <input
                autoFocus
                placeholder={dialog.placeholder || ''}
                value={dialog.value}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
              />
            )}
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => close(dialog.kind === 'confirm' ? false : null)}>Batal</button>
              <button className={`btn ${dialog.danger ? '' : ''}`} autoFocus={dialog.kind === 'confirm'}>
                {dialog.confirmLabel || 'OK'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  );
}
