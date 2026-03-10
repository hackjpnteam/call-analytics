/**
 * FileMaker Data API クライアント
 * FileMaker Server 19+ の Data API に対応
 */

interface FileMakerConfig {
  host: string;           // FileMaker Serverのホスト
  database: string;       // データベース名
  username: string;       // ユーザー名
  password: string;       // パスワード
  customerLayout: string; // 顧客レイアウト名
  callLogLayout: string;  // 通話ログレイアウト名
}

interface FileMakerSession {
  token: string;
  expiresAt: Date;
}

interface FileMakerRecord<T> {
  recordId: string;
  modId: string;
  fieldData: T;
}

interface FileMakerResponse<T> {
  response: {
    data?: FileMakerRecord<T>[];
    recordId?: string;
    modId?: string;
    scriptResult?: string;
  };
  messages: Array<{ code: string; message: string }>;
}

// 顧客データの型定義
export interface CustomerData {
  顧客ID: string;
  会社名: string;
  担当者名: string;
  電話番号: string;
  メールアドレス: string;
  住所: string;
  業種: string;
  ステータス: string;
  メモ: string;
  最終連絡日: string;
  作成日: string;
  更新日: string;
}

// 通話ログの型定義（FileMaker用）
export interface CallLogData {
  通話ID: string;
  顧客ID: string;
  電話番号: string;
  担当者: string;
  通話開始日時: string;
  通話終了日時: string;
  通話時間: number;
  通話結果: string;
  メモ: string;
}

class FileMakerClient {
  private config: FileMakerConfig | null = null;
  private session: FileMakerSession | null = null;

  setConfig(config: FileMakerConfig) {
    this.config = config;
    this.session = null;
  }

  private async getToken(): Promise<string> {
    if (!this.config) {
      throw new Error('FileMaker configuration not set');
    }

    // セッションが有効な場合は再利用
    if (this.session && this.session.expiresAt > new Date()) {
      return this.session.token;
    }

    const url = `${this.config.host}/fmi/data/v1/databases/${encodeURIComponent(this.config.database)}/sessions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64'),
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`FileMaker authentication failed: ${error.messages?.[0]?.message || response.statusText}`);
    }

    const data = await response.json();
    const token = data.response.token;

    // セッションは15分間有効（余裕を持って14分）
    this.session = {
      token,
      expiresAt: new Date(Date.now() + 14 * 60 * 1000),
    };

    return token;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<FileMakerResponse<T>> {
    if (!this.config) {
      throw new Error('FileMaker configuration not set');
    }

    const token = await this.getToken();
    const url = `${this.config.host}/fmi/data/v1/databases/${encodeURIComponent(this.config.database)}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (data.messages?.[0]?.code !== '0') {
      throw new Error(`FileMaker API error: ${data.messages?.[0]?.message}`);
    }

    return data;
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 全顧客データを取得
   */
  async getCustomers(limit = 100, offset = 1): Promise<FileMakerRecord<CustomerData>[]> {
    if (!this.config) throw new Error('FileMaker configuration not set');

    const response = await this.request<CustomerData>(
      'GET',
      `/layouts/${encodeURIComponent(this.config.customerLayout)}/records?_limit=${limit}&_offset=${offset}`
    );

    return response.response.data || [];
  }

  /**
   * 電話番号で顧客を検索
   */
  async findCustomerByPhone(phoneNumber: string): Promise<FileMakerRecord<CustomerData> | null> {
    if (!this.config) throw new Error('FileMaker configuration not set');

    // 電話番号の正規化（ハイフン除去など）
    const normalizedPhone = phoneNumber.replace(/[-\s]/g, '');

    try {
      const response = await this.request<CustomerData>(
        'POST',
        `/layouts/${encodeURIComponent(this.config.customerLayout)}/_find`,
        {
          query: [{ 電話番号: `*${normalizedPhone}*` }],
          limit: '1',
        }
      );

      return response.response.data?.[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 顧客IDで顧客を取得
   */
  async getCustomerById(customerId: string): Promise<FileMakerRecord<CustomerData> | null> {
    if (!this.config) throw new Error('FileMaker configuration not set');

    try {
      const response = await this.request<CustomerData>(
        'POST',
        `/layouts/${encodeURIComponent(this.config.customerLayout)}/_find`,
        {
          query: [{ 顧客ID: customerId }],
          limit: '1',
        }
      );

      return response.response.data?.[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 通話ログをFileMakerに書き出し
   */
  async createCallLog(callLog: CallLogData): Promise<string> {
    if (!this.config) throw new Error('FileMaker configuration not set');

    const response = await this.request<CallLogData>(
      'POST',
      `/layouts/${encodeURIComponent(this.config.callLogLayout)}/records`,
      {
        fieldData: callLog,
      }
    );

    return response.response.recordId || '';
  }

  /**
   * 複数の通話ログを一括書き出し
   */
  async createCallLogsBatch(callLogs: CallLogData[]): Promise<string[]> {
    const recordIds: string[] = [];

    for (const log of callLogs) {
      try {
        const recordId = await this.createCallLog(log);
        recordIds.push(recordId);
      } catch (error) {
        console.error('Failed to create call log:', error);
      }
    }

    return recordIds;
  }

  /**
   * 顧客データを更新
   */
  async updateCustomer(recordId: string, data: Partial<CustomerData>): Promise<void> {
    if (!this.config) throw new Error('FileMaker configuration not set');

    await this.request<CustomerData>(
      'PATCH',
      `/layouts/${encodeURIComponent(this.config.customerLayout)}/records/${recordId}`,
      {
        fieldData: data,
      }
    );
  }

  /**
   * セッションを終了
   */
  async logout(): Promise<void> {
    if (!this.session || !this.config) return;

    try {
      await fetch(
        `${this.config.host}/fmi/data/v1/databases/${encodeURIComponent(this.config.database)}/sessions/${this.session.token}`,
        { method: 'DELETE' }
      );
    } catch {
      // Ignore logout errors
    }

    this.session = null;
  }
}

// シングルトンインスタンス
export const filemakerClient = new FileMakerClient();

export default FileMakerClient;
