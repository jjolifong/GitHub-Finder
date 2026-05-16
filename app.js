class GitHubFinder {
  constructor() {
    this.form = document.getElementById("searchForm");
    this.input = document.getElementById("usernameInput");
    this.btn = document.getElementById("searchBtn");
    this.msgEmpty = document.getElementById("msgEmpty");
    this.msgError = document.getElementById("msgError");
    this.msgInfo = document.getElementById("msgInfo");
    this.srSearchAnnounce = document.getElementById("srSearchAnnounce");
    this.loading = document.getElementById("loading");
    this.profileCard = document.getElementById("profileCard");
    this.reposCard = document.getElementById("reposCard");
    this.avatar = document.getElementById("avatar");
    this.displayName = document.getElementById("displayName");
    this.loginName = document.getElementById("loginName");
    this.profileTableBody = document.getElementById("profileTableBody");
    this.profileTableWrap = document.getElementById("profileTableWrap");
    this.followers = document.getElementById("followers");
    this.following = document.getElementById("following");
    this.publicRepos = document.getElementById("publicRepos");
    this.publicGists = document.getElementById("publicGists");
    this.viewProfileBtn = document.getElementById("viewProfileBtn");
    this.contribChart = document.getElementById("contribChart");
    this.contribWrap = document.getElementById("contribWrap");
    this.repoList = document.getElementById("repoList");
    this.reposLoadMoreWrap = document.getElementById("reposLoadMoreWrap");
    this.reposLoadMoreBtn = document.getElementById("reposLoadMoreBtn");
    this.themeToggle = document.getElementById("themeToggle");

    this.themeStorageKey = "github-finder-theme";
    this.cachedRepos = [];
    this.reposVisibleCount = 0;
    this.reposPageSize = 5;

    this.form.addEventListener("submit", (e) => this.onSubmit(e));
    this.themeToggle.addEventListener("click", () => this.toggleTheme());
    this.reposLoadMoreBtn.addEventListener("click", () =>
      this.onReposLoadMore()
    );
    this.contribChart.addEventListener("error", () => {
      this.contribWrap.hidden = true;
    });
    this.contribChart.addEventListener("load", () => {
      this.contribWrap.hidden = false;
    });
    this.applyTheme(this.readStoredTheme(), false);
  }

  readStoredTheme() {
    const v = localStorage.getItem(this.themeStorageKey);
    if (v === "dark" || v === "light") return v;
    return "light";
  }

  applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist !== false) {
      localStorage.setItem(this.themeStorageKey, theme);
    }
    const isDark = theme === "dark";
    this.themeToggle.textContent = isDark ? "라이트 모드" : "다크 모드";
    this.themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  toggleTheme() {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    this.applyTheme(next, true);
  }

  hideMessages() {
    this.msgEmpty.classList.remove("visible");
    this.msgError.classList.remove("visible");
    this.msgInfo.classList.remove("visible");
  }

  showEmpty() {
    this.hideMessages();
    this.msgEmpty.textContent = "검색할 사용자명을 입력해 주세요.";
    this.msgEmpty.classList.add("visible");
  }

  show404() {
    this.hideMessages();
    this.msgError.textContent =
      "사용자를 찾을 수 없습니다(404). 사용자명을 확인한 뒤 다시 시도해 주세요.";
    this.msgError.classList.add("visible");
  }

  showError(text) {
    this.hideMessages();
    this.msgError.textContent = text;
    this.msgError.classList.add("visible");
  }

  setLoading(on) {
    this.loading.classList.toggle("visible", on);
    this.loading.setAttribute("aria-busy", on ? "true" : "false");
    this.btn.disabled = on;
  }

  hideResults() {
    this.profileCard.classList.remove("visible");
    this.reposCard.classList.remove("visible");
    this.cachedRepos = [];
    this.reposVisibleCount = 0;
    this.repoList.innerHTML = "";
    this.reposLoadMoreWrap.hidden = true;
    this.profileTableBody.innerHTML = "";
    this.profileTableWrap.classList.add("is-empty");
    this.contribChart.removeAttribute("src");
    this.contribWrap.hidden = false;
    this.srSearchAnnounce.textContent = "";
  }

  escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  formatNumber(n) {
    const num = typeof n === "number" ? n : Number(n);
    if (typeof num === "number" && Number.isFinite(num)) {
      return num.toLocaleString("ko-KR");
    }
    return "0";
  }

  profileScreenReaderSummary(user, login) {
    const followers = this.formatNumber(user.followers);
    const publicRepos = this.formatNumber(user.public_repos);
    const rawName = user.name != null ? String(user.name).trim() : "";
    const displayName = rawName.length > 0 ? rawName : login;
    return {
      displayName,
      followers,
      publicRepos,
      avatarAlt:
        login +
        "님의 프로필 사진. 팔로워 " +
        followers +
        "명, 공개 저장소 " +
        publicRepos +
        "개",
      successAnnounce:
        displayName +
        " 님의 프로필을 불러왔습니다. 팔로워 " +
        followers +
        "명, 공개 저장소 " +
        publicRepos +
        "개",
    };
  }

  formatMemberSince(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(d);
  }

  normalizeBlogUrl(blog) {
    const t = String(blog).trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return "https://" + t;
  }

  pushTableRow(rows, label, valueHtml) {
    if (!valueHtml) return;
    rows.push(
      `<tr><th scope="row">${this.escapeHtml(label)}</th><td>${valueHtml}</td></tr>`
    );
  }

  renderProfileTable(user) {
    const rows = [];

    const companyRaw = user.company;
    let companyCell = "-";
    if (companyRaw !== null && companyRaw !== undefined) {
      const company =
        typeof companyRaw === "string"
          ? companyRaw.trim()
          : String(companyRaw).trim();
      if (
        company.length > 0 &&
        company.toLowerCase() !== "null"
      ) {
        companyCell = this.escapeHtml(company);
      }
    }
    this.pushTableRow(rows, "회사", companyCell);

    const blog = user.blog != null ? String(user.blog).trim() : "";
    if (blog) {
      const url = this.normalizeBlogUrl(blog);
      const safe = this.escapeHtml(url);
      const text = this.escapeHtml(blog);
      this.pushTableRow(
        rows,
        "웹사이트·블로그",
        `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`
      );
    }

    const location =
      user.location != null ? String(user.location).trim() : "";
    if (location) {
      this.pushTableRow(
        rows,
        "위치",
        this.escapeHtml(location)
      );
    }

    if (user.created_at) {
      this.pushTableRow(
        rows,
        "가입일",
        this.escapeHtml(this.formatMemberSince(user.created_at))
      );
    }

    this.profileTableBody.innerHTML = rows.join("");
    this.profileTableWrap.classList.toggle("is-empty", rows.length === 0);
  }

  contribChartUrl(login) {
    return "https://grass-graph.moshimo.works/images/" + login + ".png";
  }

  repoWatchersCount(r) {
    if (typeof r.subscribers_count === "number") return r.subscribers_count;
    if (typeof r.watchers_count === "number") return r.watchers_count;
    if (typeof r.watchers === "number") return r.watchers;
    return 0;
  }

  repoForksCount(r) {
    const n = r.forks;
    if (typeof n === "number" && Number.isFinite(n)) return n;
    const parsed = Number(n);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  createRepoListItem(r, options) {
    const opts = options || {};
    const li = document.createElement("li");
    if (opts.animateEnter) {
      li.classList.add("repo-item-enter");
    }
    const link = document.createElement("a");
    link.href = r.html_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = r.name;
    li.appendChild(link);
    const meta = document.createElement("div");
    meta.className = "repo-meta";
    const parts = [];
    if (r.language) parts.push(r.language);
    if (r.stargazers_count != null) {
      parts.push("★ " + this.formatNumber(r.stargazers_count));
    }
    const w = this.repoWatchersCount(r);
    parts.push("구독자 " + this.formatNumber(w));
    parts.push("포크 " + this.formatNumber(this.repoForksCount(r)));
    if (r.updated_at) {
      try {
        parts.push(
          "수정: " +
            new Date(r.updated_at).toLocaleDateString("ko-KR")
        );
      } catch {
        parts.push("수정: " + r.updated_at);
      }
    }
    meta.textContent = parts.join(" · ");
    li.appendChild(meta);
    return li;
  }

  syncReposLoadMoreButton() {
    const hasMore =
      this.cachedRepos.length > 0 &&
      this.reposVisibleCount < this.cachedRepos.length;
    this.reposLoadMoreWrap.hidden = !hasMore;
  }

  populateReposSection(repos) {
    this.cachedRepos = repos;
    this.reposVisibleCount = 0;
    this.repoList.innerHTML = "";

    if (!repos.length) {
      const li = document.createElement("li");
      li.textContent = "공개 저장소가 없습니다.";
      li.style.color = "var(--muted)";
      this.repoList.appendChild(li);
      this.reposLoadMoreWrap.hidden = true;
      return;
    }

    const first = Math.min(this.reposPageSize, repos.length);
    for (let i = 0; i < first; i++) {
      this.repoList.appendChild(this.createRepoListItem(repos[i]));
    }
    this.reposVisibleCount = first;
    this.syncReposLoadMoreButton();
  }

  onReposLoadMore() {
    if (!this.cachedRepos.length) return;
    const next = Math.min(
      this.reposVisibleCount + this.reposPageSize,
      this.cachedRepos.length
    );
    let firstNewLi = null;
    for (let i = this.reposVisibleCount; i < next; i++) {
      const li = this.createRepoListItem(this.cachedRepos[i], {
        animateEnter: true,
      });
      if (!firstNewLi) firstNewLi = li;
      this.repoList.appendChild(li);
    }
    this.reposVisibleCount = next;
    this.syncReposLoadMoreButton();

    if (firstNewLi) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          firstNewLi.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });
        });
      });
    }
  }

  async fetchAllReposForUser(login) {
    const perPage = 100;
    const url =
      "https://api.github.com/users/" +
      encodeURIComponent(login) +
      "/repos?sort=updated&direction=desc&per_page=" +
      perPage +
      "&page=1";
    const res = await fetch(url);
    if (!res.ok) return null;
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list;
  }

  async onSubmit(e) {
    e.preventDefault();
    const username = this.input.value.trim();

    this.hideMessages();
    this.hideResults();

    if (!username) {
      this.showEmpty();
      return;
    }

    this.setLoading(true);

    const userUrl =
      "https://api.github.com/users/" + encodeURIComponent(username);

    try {
      const userRes = await fetch(userUrl);

      if (userRes.status === 404) {
        this.show404();
        return;
      }

      if (!userRes.ok) {
        throw new Error("프로필을 불러오지 못했습니다(" + userRes.status + ").");
      }

      const user = await userRes.json();
      const login = user.login || username;

      const srSummary = this.profileScreenReaderSummary(user, login);
      this.avatar.src = user.avatar_url || "";
      this.avatar.alt = srSummary.avatarAlt;

      const name = user.name || login;
      this.displayName.textContent = name;
      this.loginName.textContent = "@" + login;

      this.followers.textContent = this.formatNumber(user.followers);
      this.following.textContent = this.formatNumber(user.following);
      this.publicRepos.textContent = this.formatNumber(user.public_repos);
      this.publicGists.textContent = this.formatNumber(user.public_gists);

      this.renderProfileTable(user);

      const profileUrl =
        user.html_url || "https://github.com/" + encodeURIComponent(login);
      this.viewProfileBtn.href = profileUrl;

      this.profileCard.classList.add("visible");

      this.srSearchAnnounce.textContent = srSummary.successAnnounce;

      this.contribChart.src = this.contribChartUrl(login);
      this.contribChart.alt = login + "님의 기여 활동 그래프";

      const repos = await this.fetchAllReposForUser(login);

      if (repos === null) {
        this.hideMessages();
        this.msgInfo.textContent =
          "저장소 목록을 불러오지 못했습니다. 프로필은 그대로 표시됩니다.";
        this.msgInfo.classList.add("visible");
        this.reposCard.classList.add("visible");
        return;
      }

      this.populateReposSection(repos);
      this.reposCard.classList.add("visible");
    } catch (err) {
      this.showError(err.message || "네트워크 오류가 발생했습니다.");
    } finally {
      this.setLoading(false);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GitHubFinder();
});
