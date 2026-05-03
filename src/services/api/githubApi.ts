import { Octokit } from 'octokit';
import { useAuthStore } from '@/store/authStore';

const REPO_OWNER = import.meta.env.VITE_GITHUB_REPO_OWNER || '';
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO_NAME || '';
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CreatePRRequest {
  policyName: string;
  regoCode: string;
  configJson: string;
  metadata: {
    description: string;
    author: string;
    tags: string[];
  };
}

export interface CreatePRResponse {
  prNumber: number;
  prUrl: string;
  branchName: string;
}

export const githubApi = {
  /**
   * Step 1: Request device and user codes from GitHub
   * Returns codes that user needs to enter at github.com/login/device
   */
  requestDeviceCode: async (): Promise<DeviceCodeResponse> => {
    if (!CLIENT_ID) {
      throw new Error('VITE_GITHUB_CLIENT_ID is not configured');
    }

    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: 'repo',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to request device code');
    }

    return response.json();
  },

  /**
   * Step 2: Poll for access token while user authorizes
   * Returns token once user completes authorization at github.com/login/device
   */
  pollForToken: async (
    deviceCode: string,
    interval: number,
    onPending?: () => void
  ): Promise<string> => {
    const pollInterval = Math.max(interval, 5) * 1000; // GitHub requires minimum 5 seconds

    while (true) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        return data.access_token;
      }

      if (data.error === 'authorization_pending') {
        onPending?.();
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (data.error === 'slow_down') {
        // GitHub is asking us to slow down, add extra time
        await new Promise(resolve => setTimeout(resolve, pollInterval + 5000));
        continue;
      }

      if (data.error === 'expired_token') {
        throw new Error('Authorization expired. Please try again.');
      }

      if (data.error === 'access_denied') {
        throw new Error('Authorization was denied.');
      }

      throw new Error(data.error_description || data.error || 'Authorization failed');
    }
  },

  /**
   * Fetch the authenticated user's profile
   */
  fetchUser: async (token: string): Promise<GitHubUser> => {
    const octokit = new Octokit({ auth: token });

    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      return {
        id: data.id,
        login: data.login,
        avatar_url: data.avatar_url,
        name: data.name,
      };
    } catch {
      throw new Error('Failed to fetch user profile');
    }
  },

  /**
   * Complete device flow login: request code, poll for token, fetch user
   */
  loginWithDeviceFlow: async (
    onDeviceCode: (response: DeviceCodeResponse) => void,
    onPending?: () => void
  ): Promise<{ token: string; user: GitHubUser }> => {
    // Step 1: Get device code
    const deviceCodeResponse = await githubApi.requestDeviceCode();
    onDeviceCode(deviceCodeResponse);

    // Step 2: Poll for token (user authorizes in browser)
    const token = await githubApi.pollForToken(
      deviceCodeResponse.device_code,
      deviceCodeResponse.interval,
      onPending
    );

    // Step 3: Fetch user profile
    const user = await githubApi.fetchUser(token);

    return { token, user };
  },

  /**
   * Validate an existing token and refresh user info
   */
  validateToken: async (token: string): Promise<GitHubUser | null> => {
    try {
      return await githubApi.fetchUser(token);
    } catch {
      return null;
    }
  },

  /**
   * Create a Pull Request with policy files
   */
  createPullRequest: async (
    request: CreatePRRequest
  ): Promise<CreatePRResponse> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    if (!REPO_OWNER || !REPO_NAME) {
      throw new Error('GitHub repository not configured. Set VITE_GITHUB_REPO_OWNER and VITE_GITHUB_REPO_NAME.');
    }

    const octokit = new Octokit({ auth: token });
    const branchName = `policy/${request.policyName}-${Date.now()}`;

    const { data: repo } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });

    const defaultBranch = repo.default_branch;

    const { data: ref } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${defaultBranch}`,
    });

    const baseSha = ref.object.sha;

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    const policyPath = `policies/${request.policyName}.rego`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: policyPath,
      message: `Add policy: ${request.policyName}`,
      content: btoa(request.regoCode),
      branch: branchName,
    });

    const configPath = `configuration/${request.policyName}.json`;
    const configContent = JSON.stringify(
      JSON.parse(request.configJson),
      null,
      2
    );

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: configPath,
      message: `Add configuration for policy: ${request.policyName}`,
      content: btoa(configContent),
      branch: branchName,
    });

    const prBody = `## New Policy: ${request.policyName}

${request.metadata.description}

### Files Added
- \`${policyPath}\` - Rego policy
- \`${configPath}\` - Policy configuration

### Metadata
- **Author**: ${request.metadata.author}
- **Tags**: ${request.metadata.tags.join(', ') || 'None'}

---
*Created via OPA Policy Registry*`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `[Policy] Add ${request.policyName}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
    });

    return {
      prNumber: pr.number,
      prUrl: pr.html_url,
      branchName,
    };
  },

  /**
   * Get current authenticated user
   */
  getUser: async (): Promise<GitHubUser> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Not authenticated');
    }

    return githubApi.fetchUser(token);
  },
};
