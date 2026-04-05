export default function SettingsPage() {
  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Система</p>
          <h3>Службові дії та безпека</h3>
        </div>
        <p className="section-copy">
          Цей розділ для технічного обслуговування: логи, резервні копії та
          контроль критичних дій.
        </p>
      </section>

      <section className="stats-grid">
        <article className="card metric-card">
          <p className="card-kicker">Логи дій</p>
          <h3>Увімкнено</h3>
          <p className="muted-text">Фіксуємо зміни по замовленнях та фінансах</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Backup</p>
          <h3>Доступно</h3>
          <p className="muted-text">Створення та відновлення бази даних</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Ролі</p>
          <h3>Контроль</h3>
          <p className="muted-text">Критичні кнопки тільки для суперадміна</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Стан</p>
          <h3>Робочий</h3>
          <p className="muted-text">Система готова до щоденної роботи</p>
        </article>
      </section>

      <section className="card">
        <p className="card-kicker">Правила безпеки</p>
        <ul className="mini-list">
          <li>Не видавайте роль `super_admin` без потреби</li>
          <li>Перед критичними змінами робіть backup</li>
          <li>Кнопки повного очищення мають бути тільки у суперадміна</li>
        </ul>
      </section>
    </div>
  );
}
