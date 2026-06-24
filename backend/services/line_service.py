"""
LINE 收發層（line-bot-sdk v3）
封裝簽章驗證、webhook 事件解析、reply / push / loading 動畫。
"""
from linebot.v3 import WebhookParser
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi,
    ReplyMessageRequest, PushMessageRequest, TextMessage,
    ShowLoadingAnimationRequest,
)

# LINE 單則文字訊息上限 5000 字
LINE_TEXT_LIMIT = 5000


class LineService:
    """單一租戶的 LINE 服務（以該租戶的 channel 憑證初始化）。"""

    def __init__(self, channel_access_token: str, channel_secret: str):
        self.configuration = Configuration(access_token=channel_access_token)
        self.parser = WebhookParser(channel_secret)

    def parse(self, body: str, signature: str):
        """驗章 + 解析 webhook；簽章錯誤會 raise InvalidSignatureError。"""
        return self.parser.parse(body, signature)

    @staticmethod
    def _truncate(text: str) -> str:
        text = text or ""
        return text[:LINE_TEXT_LIMIT] if len(text) > LINE_TEXT_LIMIT else text

    def reply(self, reply_token: str, text: str):
        """以 reply token 回覆（免費、但 token 約 30 秒且單次有效）。

        使用 *_with_http_info（對齊既有驗證過的 LINE 實作）。
        """
        with ApiClient(self.configuration) as api_client:
            MessagingApi(api_client).reply_message_with_http_info(
                ReplyMessageRequest(
                    reply_token=reply_token,
                    messages=[TextMessage(text=self._truncate(text))],
                )
            )

    def push(self, user_id: str, text: str):
        """主動推播（不需 token，作為 reply 逾時的 fallback）。"""
        with ApiClient(self.configuration) as api_client:
            MessagingApi(api_client).push_message_with_http_info(
                PushMessageRequest(
                    to=user_id,
                    messages=[TextMessage(text=self._truncate(text))],
                )
            )

    def show_loading(self, user_id: str, seconds: int = 40):
        """顯示「正在輸入」動畫（最多 60 秒，僅 1:1 聊天）。失敗不中斷流程。"""
        try:
            with ApiClient(self.configuration) as api_client:
                MessagingApi(api_client).show_loading_animation(
                    ShowLoadingAnimationRequest(
                        chatId=user_id,
                        loadingSeconds=min(seconds, 60),
                    )
                )
        except Exception as e:
            print(f"[LINE] loading 動畫失敗: {e}")
