import * as _tanstack_react_query from '@tanstack/react-query';

declare function useAuth(): {
    user: any;
    isLoading: boolean;
    isAuthenticated: boolean;
    logout: _tanstack_react_query.UseMutateFunction<void, Error, void, unknown>;
    isLoggingOut: boolean;
};

export { useAuth };
