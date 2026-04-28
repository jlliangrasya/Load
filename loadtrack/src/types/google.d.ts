/* Google Identity Services + gapi type stubs */

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in?: number;
    error?: string;
    scope?: string;
    token_type?: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    prompt?: string;
  }

  interface TokenClient {
    requestAccessToken(options?: { prompt?: string }): void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(token: string, callback?: () => void): void;
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;

  namespace client {
    function init(config: Record<string, unknown>): Promise<void>;
    function load(discoveryDoc: string): Promise<void>;
    function setToken(token: { access_token: string }): void;

    namespace drive {
      namespace files {
        function list(params: {
          q: string;
          fields: string;
          spaces: string;
        }): Promise<{
          result: {
            files?: Array<{ id?: string; name?: string }>;
          };
        }>;

        function create(params: {
          resource: {
            name: string;
            mimeType: string;
            parents?: string[];
          };
          fields: string;
        }): Promise<{
          result: { id?: string };
        }>;
      }
    }
  }
}
