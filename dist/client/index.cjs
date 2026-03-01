"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var client_exports = {};
__export(client_exports, {
  useAuth: () => useAuth
});
module.exports = __toCommonJS(client_exports);

// src/client/use-auth.ts
var import_react_query = require("@tanstack/react-query");
async function fetchUser() {
  const response = await fetch("/api/auth/user", {
    credentials: "include"
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}
async function logout() {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  window.location.href = "/";
}
function useAuth() {
  const queryClient = (0, import_react_query.useQueryClient)();
  const { data: user, isLoading } = (0, import_react_query.useQuery)({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1e3 * 60 * 5
  });
  const logoutMutation = (0, import_react_query.useMutation)({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    }
  });
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  useAuth
});
