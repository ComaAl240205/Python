// src/views/authView.js
// Rendert Login/Register HTML.
// Keine Backend-Logik hier. Nur HTML.

export function authView(activeView) {
  const isLogin = activeView === "login";
  const isRegister = activeView === "register";

  return `
    <section class="card" id="authCard">
      <div class="tabs">
        <button 
          class="tab ${isLogin ? "active" : ""}" 
          data-action="show-login">
          Login
        </button>

        <button 
          class="tab ${isRegister ? "active" : ""}" 
          data-action="show-register">
          Register
        </button>
      </div>

      ${
        isLogin
          ? `
            <div id="loginView">
              <div class="grid2">
                <div class="form-group">
                  <label>Username</label>
                  <input id="loginUser" placeholder="max.mustermann" />
                </div>

                <div class="form-group">
                  <label>Password</label>
                  <input id="loginPass" type="password" placeholder="••••••••" />
                </div>
              </div>

              <button class="btn primary" data-action="login">
                Login
              </button>

              <p class="hint" id="authMsg"></p>
            </div>
          `
          : `
            <div id="registerView">
              <div class="grid2">
                <div class="form-group">
                  <label>Username</label>
                  <input id="regUser" placeholder="Dein Username (min. 3)" />
                </div>

                <div class="form-group">
                  <label>Password</label>
                  <input id="regPass" type="password" placeholder="Min. 6 Zeichen" />
                </div>
              </div>

              <button class="btn primary" data-action="register">
                Account erstellen
              </button>

              <p class="hint" id="regMsg"></p>
            </div>
          `
      }
    </section>
  `;
}
``