import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const user = await login(username, password);
      if (user.role === 'super_admin' || user.role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/orders', { replace: true });
      }
    } catch (loginError) {
      if (!loginError?.response) {
        setError('Сервер недоступний. Перевірте, чи запущено backend на 8000.');
      } else {
        setError('Невірний логін або пароль');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel card">
        <div className="login-copy">
          <p className="eyebrow">Production OS v2</p>
          <h1>Робоча система замовлень, фінансів і планування</h1>
          <p className="muted-text">
            Без зайвих екранів: основні модулі і чітка логіка дій на кожен день.
          </p>

          <div className="login-highlights">
            <div className="login-feature">
              <strong>Замовлення</strong>
              <span>реєстр, картка, відповідальні, статуси</span>
            </div>
            <div className="login-feature">
              <strong>Планування</strong>
              <span>етапи, дати, Gantt та контроль строків</span>
            </div>
            <div className="login-feature">
              <strong>Фінанси</strong>
              <span>платежі, борги, штрафи і розподіл</span>
            </div>
          </div>
        </div>

        <div className="login-form-wrap">
          <div className="login-card">
            <p className="card-kicker">Вхід у систему</p>
            <h2>Увійти в `app-v2`</h2>

            {error ? <div className="form-error">{error}</div> : null}

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Логін</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Введіть логін"
                  required
                />
              </label>

              <label className="field">
                <span>Пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Введіть пароль"
                  required
                />
              </label>

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Вхід...' : 'Увійти'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
