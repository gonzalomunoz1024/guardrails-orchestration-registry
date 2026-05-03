import { useMutation } from '@tanstack/react-query';
import { githubApi, type CreatePRResponse } from '@/services/api';
import { usePolicyStore, useAuthStore } from '@/store';
import { slugify } from '@/utils';

export function useCreatePR() {
  const { regoCode, configJson, metadata } = usePolicyStore();
  const { isAuthenticated } = useAuthStore();

  const mutation = useMutation<CreatePRResponse, Error, void>({
    mutationFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Please sign in with GitHub first');
      }

      if (!metadata.name) {
        throw new Error('Policy name is required');
      }

      return githubApi.createPullRequest({
        policyName: slugify(metadata.name),
        regoCode,
        configJson,
        metadata: {
          description: metadata.description,
          author: metadata.author,
          tags: metadata.tags,
        },
      });
    },
  });

  return {
    createPR: mutation.mutate,
    isCreating: mutation.isPending,
    error: mutation.error,
    prResult: mutation.data,
    reset: mutation.reset,
  };
}
