(function () {
  var config = window.NETLIFY_APP_CONFIG || {};
  var apiBaseUrl = String(config.apiBaseUrl || "").trim();
  var useTextPlainJson = config.useTextPlainJson !== false;

  function ensureApiBaseUrl() {
    if (!apiBaseUrl) {
      throw new Error("Не указан NETLIFY_APP_CONFIG.apiBaseUrl в config.js");
    }
    return apiBaseUrl;
  }

  function buildUrl(action, payload) {
    var url = new URL(ensureApiBaseUrl(), window.location.origin);
    var data = payload || {};
    url.searchParams.set("api", "1");
    url.searchParams.set("action", action);
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      if (value === undefined || value === null || Array.isArray(value) || typeof value === "object") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function normalizeError(message) {
    return message instanceof Error ? message : new Error(String(message || "Что-то пошло не так"));
  }

  function parseApiResponse(payload) {
    if (!payload || payload.ok !== true) {
      throw normalizeError(payload && payload.error ? payload.error : "Некорректный ответ API");
    }
    return payload.result;
  }

  async function callGet(action, payload) {
    var response = await fetch(buildUrl(action, payload), {
      method: "GET"
    });
    if (!response.ok) {
      throw new Error("API недоступен: HTTP " + response.status);
    }
    return parseApiResponse(await response.json());
  }

  async function callPost(action, payload) {
    var response = await fetch(ensureApiBaseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": useTextPlainJson ? "text/plain;charset=UTF-8" : "application/json"
      },
      body: JSON.stringify({
        action: action,
        payload: payload || {}
      })
    });
    if (!response.ok) {
      throw new Error("API недоступен: HTTP " + response.status);
    }
    return parseApiResponse(await response.json());
  }

  function mapArgsToPayload(action, args) {
    switch (action) {
      case "getData":
      case "getSharedSpaceBootstrap":
      case "getDirectSharedSpaceBootstrap":
      case "verifySpaceShareAccess":
      case "addSpace":
      case "getSpaceShareSettings":
      case "updateSpacePassword":
      case "regenerateSpaceShareLink":
      case "toggleSpaceShare":
      case "regenerateDirectAccessLink":
      case "toggleDirectAccess":
      case "addFolder":
      case "updateFolder":
      case "copyFolderToFolders":
      case "moveFolder":
      case "deleteFolderRecursive":
      case "addMaterial":
      case "updateMaterial":
      case "addMaterialToFolders":
      case "deleteMaterial":
      case "removeMaterialFromFolder":
        break;
      default:
        throw new Error("Неизвестное действие API: " + action);
    }

    switch (action) {
      case "getData":
        return {};
      case "getSharedSpaceBootstrap":
        return { shareSlug: args[0] };
      case "getDirectSharedSpaceBootstrap":
        return { directAccessToken: args[0] };
      case "verifySpaceShareAccess":
        return { shareSlug: args[0], password: args[1] };
      case "addSpace":
        return { name: args[0], description: args[1] };
      case "getSpaceShareSettings":
      case "regenerateSpaceShareLink":
      case "regenerateDirectAccessLink":
      case "deleteFolderRecursive":
      case "deleteMaterial":
        return { spaceId: args[0], folderId: args[0], materialId: args[0] };
      case "updateSpacePassword":
        return { spaceId: args[0], password: args[1] };
      case "toggleSpaceShare":
        return { spaceId: args[0], enabled: args[1] };
      case "toggleDirectAccess":
        return { spaceId: args[0], enabled: args[1] };
      case "addFolder":
        return { name: args[0], parentId: args[1], description: args[2], availableFrom: args[3], spaceId: args[4] };
      case "updateFolder":
        return { folderId: args[0], name: args[1], description: args[2], availableFrom: args[3] };
      case "copyFolderToFolders":
        return { folderId: args[0], targetFolderIds: args[1] };
      case "moveFolder":
        return { folderId: args[0], newParentId: args[1] };
      case "addMaterial":
        return { folderId: args[0], title: args[1], url: args[2], description: args[3], tags: args[4] };
      case "updateMaterial":
        return { materialId: args[0], title: args[1], url: args[2], description: args[3], tags: args[4] };
      case "addMaterialToFolders":
        return { materialId: args[0], folderIds: args[1] };
      case "removeMaterialFromFolder":
        return { materialId: args[0], folderId: args[1] };
      default:
        return {};
    }
  }

  function fixPayloadForAction(action, payload) {
    if (action === "getSpaceShareSettings" || action === "regenerateSpaceShareLink" || action === "regenerateDirectAccessLink") {
      return { spaceId: payload.spaceId };
    }
    if (action === "deleteFolderRecursive") {
      return { folderId: payload.folderId };
    }
    if (action === "deleteMaterial") {
      return { materialId: payload.materialId };
    }
    return payload;
  }

  function createRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === "withSuccessHandler") {
          return function (handler) {
            return createRunner(handler, failureHandler);
          };
        }
        if (prop === "withFailureHandler") {
          return function (handler) {
            return createRunner(successHandler, handler);
          };
        }
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var action = String(prop);
          var payload;
          var request;

          try {
            payload = fixPayloadForAction(action, mapArgsToPayload(action, args));
          } catch (error) {
            if (failureHandler) {
              failureHandler(error);
              return;
            }
            throw error;
          }

          request = action === "getData" ||
            action === "getSharedSpaceBootstrap" ||
            action === "getDirectSharedSpaceBootstrap"
            ? callGet(action, payload)
            : callPost(action, payload);

          request.then(function (result) {
            if (successHandler) {
              successHandler(result);
            }
          }).catch(function (error) {
            if (failureHandler) {
              failureHandler(normalizeError(error && error.message ? error.message : error));
              return;
            }
            throw error;
          });
        };
      }
    });
  }

  window.netlifyApi = {
    getData: function () {
      return callGet("getData", {});
    },
    getSharedSpaceBootstrap: function (shareSlug) {
      return callGet("getSharedSpaceBootstrap", { shareSlug: shareSlug });
    },
    getDirectSharedSpaceBootstrap: function (directAccessToken) {
      return callGet("getDirectSharedSpaceBootstrap", { directAccessToken: directAccessToken });
    }
  };

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner(null, null);
})();
