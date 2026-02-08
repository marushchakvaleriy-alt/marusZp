import requests
from settings import load_settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.settings = load_settings()
        self.token = self.settings.telegram_bot_token
        self.base_url = f"https://api.telegram.org/bot{self.token}"

    def send_message(self, chat_id: str, text: str):
        """Sends a message to a specific Telegram chat ID."""
        if not self.token:
            logger.warning("Telegram Bot Token is not set. Skipping notification.")
            return False
            
        if not chat_id:
            logger.warning("Telegram Chat ID is missing. Skipping notification.")
            return False

        try:
            url = f"{self.base_url}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            }
            response = requests.post(url, json=payload, timeout=5)
            
            if response.status_code == 200:
                logger.info(f"Telegram notification sent to {chat_id}")
                return True
            else:
                logger.error(f"Failed to send Telegram message: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False

    def notify_order_assigned(self, order, constructor):
        """Notifier for when an order is assigned to a constructor."""
        if not constructor.telegram_id:
            return

        message = (
            f"👷‍♂️ <b>ПРИЗНАЧЕНО НОВЕ ЗАМОВЛЕННЯ</b>\n\n"
            f"🆔 <b>ID:</b> {order.name}\n"
            f"📅 <b>Дата отримання:</b> {order.date_received}\n"
            f"💰 <b>Вартість:</b> {order.price} грн\n"
            f"🛠 <b>Бонус конструктора:</b> {order.price * 0.05:.2f} грн\n\n"
            f"<i>Бажаємо успішної роботи!</i> 🚀"
        )
        self.send_message(constructor.telegram_id, message)

    def notify_payment(self, payment, allocated_amount, order_name, constructor):
        """Notifier for when a payment is received."""
        if not constructor.telegram_id:
            return

        message = (
            f"💸 <b>ОТРИМАНО ОПЛАТУ</b>\n\n"
            f"🆔 <b>Замовлення:</b> {order_name}\n"
            f"💰 <b>Сума:</b> {allocated_amount:.2f} грн\n"
            f"📅 <b>Дата:</b> {payment.date_received}\n\n"
            f"<i>Баланс оновлено.</i>"
        )
        self.send_message(constructor.telegram_id, message)

    def notify_deduction(self, deduction, order_name, constructor):
        """Notifier for when a deduction (fine) is created."""
        if not constructor.telegram_id:
            return

        message = (
            f"⚠️ <b>НОВЕ ВІДРАХУВАННЯ (ШТРАФ)</b>\n\n"
            f"🆔 <b>Замовлення:</b> {order_name}\n"
            f"💰 <b>Сума:</b> {deduction.amount:.2f} грн\n"
            f"📝 <b>Причина:</b> {deduction.description}\n\n"
            f"<i>Будь ласка, будьте уважніші.</i>"
        )
        self.send_message(constructor.telegram_id, message)
