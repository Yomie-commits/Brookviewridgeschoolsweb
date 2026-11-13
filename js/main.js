/* ==========================================================================
   BROOKVIEW RIDGE SCHOOLS — shared site behaviour
   Mobile nav, scroll-reveal (AOS), gallery filter + lightbox, current year,
   live enquiry forms and News & Events feed (backed by the school
   management system's public API).
   ========================================================================== */
(function () {
  "use strict";

  /* Base URL of the school management system's public website API.
     Update this if the site is deployed at a different path/domain relative
     to the school-management-system app — every form and the News & Events
     page reads from this one constant. */
  var apiMeta = document.querySelector('meta[name="brookview-api-base"]');
  var API_BASE = (apiMeta && apiMeta.content) || "/school-management-system/api/website";

  document.addEventListener("DOMContentLoaded", function () {

    /* ---- Portal links ------------------------------------------------------------------
       Links marked data-portal default to the portal installed in /school-management-system/.
       If the portal lives elsewhere, add <meta name="brookview-portal-base" content="https://portal.example.com/">
       to the pages and every login / sign-up link follows. */
    var portalMeta = document.querySelector('meta[name="brookview-portal-base"]');
    if (portalMeta && portalMeta.content) {
      var portalBase = portalMeta.content.replace(/\/+$/, "") + "/";
      document.querySelectorAll("a[data-portal]").forEach(function (a) {
        a.setAttribute("href", portalBase + a.getAttribute("data-portal"));
      });
    }

    /* ---- Public site settings --------------------------------------------------------
       Non-secret values (Turnstile site key, Analytics ID, map address, privacy version) come
       from the school system, so changing them never means editing or re-uploading pages.
       If the request fails or is slow, the site simply behaves as if nothing is configured. */
    var siteConfig = Promise.race([
      fetch(API_BASE + "/public-config.php", { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; }),
      new Promise(function (resolve) { setTimeout(function () { resolve({}); }, 2500); }),
    ]);

    /* ---- Init AOS (subtle fade-up on scroll) if the library loaded ------- */
    if (window.AOS) {
      AOS.init({
        duration: 650,
        easing: "ease-out-cubic",
        once: true,
        offset: 60,
      });
    }

    /* ---- Current year in footer ------------------------------------------ */
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    /* ---- Mobile nav toggle -------------------------------------------------- */
    var navToggle = document.querySelector(".nav-toggle");
    var navLinks = document.querySelector(".nav-links");
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", function () {
        var isOpen = navLinks.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        navToggle.innerHTML = isOpen
          ? '<i class="fa-solid fa-xmark"></i>'
          : '<i class="fa-solid fa-bars"></i>';
      });
      navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          navLinks.classList.remove("open");
          navToggle.setAttribute("aria-expanded", "false");
          navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        });
      });
    }

    /* ---- Mark active nav link based on current page ------------------------- */
    var currentPage = (window.location.pathname.split("/").pop() || "index.html");
    document.querySelectorAll(".nav-links a[href]").forEach(function (link) {
      var href = link.getAttribute("href");
      if (href === currentPage || (currentPage === "" && href === "index.html")) {
        link.classList.add("active");
      }
    });

    /* ---- Gallery filter ------------------------------------------------------ */
    /* Delegated on the grid container (never replaced, only its contents are) and queried live
       on every click, so this keeps working after the Gallery's real photos load in below and
       replace the fallback markup — no rebinding needed. */
    var filterBtns = document.querySelectorAll(".gallery-filter-btn");
    var galleryGrid = document.querySelector("[data-gallery-grid]");
    if (filterBtns.length && galleryGrid) {
      filterBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          filterBtns.forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          var cat = btn.getAttribute("data-filter");
          galleryGrid.querySelectorAll(".gallery-item").forEach(function (item) {
            var show = cat === "all" || item.getAttribute("data-category") === cat;
            item.style.display = show ? "" : "none";
          });
        });
      });
    }

    /* ---- Lightbox ---------------------------------------------------------------- */
    /* Delegated on document so it also covers gallery items that load in dynamically below. */
    var lightbox = document.querySelector(".lightbox-overlay");
    if (lightbox) {
      var lightboxBody = lightbox.querySelector(".lightbox-box");
      document.addEventListener("click", function (e) {
        var trigger = e.target.closest("[data-lightbox-trigger]");
        if (!trigger) return;
        var html = trigger.querySelector(".photo-placeholder, img");
        if (html && lightboxBody) {
          var clone = html.cloneNode(true);
          var existing = lightboxBody.querySelector(".photo-placeholder, img");
          if (existing) existing.remove();
          lightboxBody.insertBefore(clone, lightboxBody.querySelector(".lightbox-caption"));
          var caption = trigger.getAttribute("data-caption") || "";
          var captionEl = lightboxBody.querySelector(".lightbox-caption");
          if (captionEl) captionEl.textContent = caption;
        }
        lightbox.classList.add("open");
        document.body.style.overflow = "hidden";
      });
      var closeBtn = lightbox.querySelector(".lightbox-close");
      function closeLightbox() {
        lightbox.classList.remove("open");
        document.body.style.overflow = "";
      }
      if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeLightbox();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeLightbox();
      });
    }

    /* ---- Gallery live feed -------------------------------------------------------- */
    /* Replaces the fallback photos on gallery.html with the real, admin-managed set from
       API_BASE + "/gallery.php" once it answers. Every one of the 8 filter categories is kept
       in the output — a category with no published photo yet falls back to the page's own
       "Photo Coming Soon" placeholder, exactly like the static markup did. If the fetch fails,
       the fallback markup already in the page (today's real photos) is left exactly as-is. */
    if (galleryGrid) {
      var galleryCatLabels = {
        classrooms: "Classrooms",
        learning: "Learning",
        play: "Play",
        teachers: "Teachers",
        meals: "Meals",
        outdoor: "Outdoor Activities",
        environment: "School Environment",
        events: "Events",
      };
      fetch(API_BASE + "/gallery.php")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok || !data.images) return;
          var byCategory = {};
          data.images.forEach(function (img) {
            (byCategory[img.category] = byCategory[img.category] || []).push(img);
          });
          // Nothing published anywhere yet: keep the existing fallback rather than show an empty grid.
          if (!data.images.length) return;

          var html = "";
          Object.keys(galleryCatLabels).forEach(function (cat) {
            var label = galleryCatLabels[cat];
            var items = byCategory[cat] || [];
            if (!items.length) {
              html += '<div class="gallery-item" data-category="' + cat + '">' +
                '<div class="photo-placeholder"><i class="fa-solid fa-camera"></i><span>Photo Coming Soon</span></div>' +
                '<span class="gallery-cat">' + label + "</span></div>";
              return;
            }
            items.forEach(function (img) {
              var caption = img.caption || "";
              var alt = img.alt_text || caption || (label + " at Brookview Ridge Schools");
              html += '<div class="gallery-item" data-category="' + cat + '" data-lightbox-trigger data-caption="' + escapeHtml(caption) + '">' +
                '<img src="' + img.photo_url + '" alt="' + escapeHtml(alt) + '" loading="lazy">' +
                '<span class="gallery-cat">' + label + "</span></div>";
            });
          });
          galleryGrid.innerHTML = html;

          // A filter other than "All" may already be active (fast network, quick click) — respect it.
          var activeFilter = document.querySelector(".gallery-filter-btn.active");
          var activeCat = activeFilter ? activeFilter.getAttribute("data-filter") : "all";
          galleryGrid.querySelectorAll(".gallery-item").forEach(function (item) {
            var show = activeCat === "all" || item.getAttribute("data-category") === activeCat;
            item.style.display = show ? "" : "none";
          });
        })
        .catch(function () {
          /* Silently keep the fallback photos already in the page — nothing to do here. */
        });
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    /* Shared by both the news feed and the single-article page below. */
    function newsFormatDate(raw) {
      return raw ? new Date(raw.replace(" ", "T")).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
    }

    /* ---- Live enquiry forms (Contact, Admissions, Transport) --------------------- */
    /* Each form posts JSON to API_BASE + "/submit-enquiry.php", which saves it to
       the website_enquiries table and emails the school office — replacing the
       previous mailto: fallback. A hidden "website" field is a honeypot: real
       visitors never fill it, so a non-empty value is silently treated as spam
       server-side. */
    /* ---- Optional Cloudflare Turnstile (bot challenge) --------------------------- */
    /* Dormant unless the page carries <meta name="brookview-turnstile-sitekey" content="...">.
       The server only enforces it when TURNSTILE_SECRET is set in the portal's .env, so the
       two are switched on together. The Cloudflare script is loaded only when configured. */
    var tsMeta = document.querySelector('meta[name="brookview-turnstile-sitekey"]');
    var TS_SITEKEY = tsMeta && tsMeta.content;   // a page-level meta tag still wins; otherwise the public config supplies it
    var tsWaiting = null;
    var tsFailed = false;

    function withTurnstile(callback) {
      if (window.turnstile) { callback(); return; }
      if (tsWaiting) { tsWaiting.push(callback); return; }
      tsWaiting = [callback];
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = function () {
        var queue = tsWaiting; tsWaiting = null;
        queue.forEach(function (fn) { fn(); });
      };
      script.onerror = function () { tsFailed = true; tsWaiting = null; };
      document.head.appendChild(script);
    }

    function showNotice(form, message, isError) {
      var notice = form.querySelector(".form-notice");
      if (!notice) return;
      notice.textContent = message;
      notice.style.color = isError ? "#b3261e" : "#1a3c34";
      notice.style.display = "block";
    }

    siteConfig.then(function (cfg) {
    if (!TS_SITEKEY && cfg && cfg.turnstile_site_key) { TS_SITEKEY = cfg.turnstile_site_key; }
    document.querySelectorAll("form[data-ajax-form]").forEach(function (form) {
      if (TS_SITEKEY) {
        var slot = document.createElement("div");
        slot.className = "turnstile-slot";
        slot.style.margin = "0.75rem 0";
        var submit = form.querySelector('button[type="submit"]');
        if (submit && submit.parentNode) { submit.parentNode.insertBefore(slot, submit); } else { form.appendChild(slot); }
        withTurnstile(function () {
          form._tsToken = "";
          form._tsId = window.turnstile.render(slot, {
            sitekey: TS_SITEKEY,
            callback: function (token) { form._tsToken = token; },
            "expired-callback": function () { form._tsToken = ""; },
            "error-callback": function () { form._tsToken = ""; },
          });
        });
      }
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (TS_SITEKEY) {
          if (tsFailed) {
            showNotice(form, "The security check could not load. Please try again, or call/WhatsApp us directly.", true);
            return;
          }
          if (!form._tsToken) {
            showNotice(form, "Please complete the security check above, then send.", true);
            return;
          }
        }

        var required = form.querySelectorAll("[required]");
        var valid = true;
        required.forEach(function (field) {
          if (field.type === "checkbox") { if (!field.checked) valid = false; }
          else if (!field.value.trim()) valid = false;
        });
        if (!valid) {
          showNotice(form, "Please fill in the required fields marked above before sending.", true);
          return;
        }

        var payload = {};
        new FormData(form).forEach(function (value, key) {
          payload[key] = value;
        });
        if (TS_SITEKEY) { payload.turnstile_token = form._tsToken || ""; }

        var submitBtn = form.querySelector('button[type="submit"]');
        var originalLabel = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "Sending&hellip;";
        }

        fetch(API_BASE + "/submit-enquiry.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (res) { return res.json().catch(function () { return {}; }); })
          .then(function (data) {
            if (data && data.ok) {
              showNotice(form, data.message || "Thank you — we have received your enquiry and will be in touch soon.", false);
              form.reset();
            } else {
              showNotice(form, (data && data.message) || "Something went wrong sending this. Please try again, or call/WhatsApp us directly.", true);
            }
          })
          .catch(function () {
            showNotice(form, "We couldn't reach the server. Please check your connection and try again, or call/WhatsApp us directly.", true);
          })
          .finally(function () {
            if (TS_SITEKEY && window.turnstile && form._tsId !== undefined) {
              form._tsToken = "";
              try { window.turnstile.reset(form._tsId); } catch (err) { /* widget gone */ }
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalLabel;
            }
          });
      });
    });

    }); /* end siteConfig.then for forms */

    /* ---- Analytics (only after the visitor accepts) and click-to-load map ------------- */
    siteConfig.then(function (cfg) {
      if (!cfg) return;

      if (cfg.analytics_id && /^G-[A-Z0-9]{6,14}$/.test(cfg.analytics_id)) {
        var KEY = "brs_analytics_choice";
        var choice = null;
        try { choice = localStorage.getItem(KEY); } catch (e) { /* storage blocked: treated as undecided */ }

        var loadAnalytics = function () {
          if (window.__brsGaLoaded) return;
          window.__brsGaLoaded = true;
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () { window.dataLayer.push(arguments); };
          window.gtag("js", new Date());
          window.gtag("config", cfg.analytics_id, { anonymize_ip: true });
          var sc = document.createElement("script");
          sc.async = true;
          sc.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.analytics_id);
          document.head.appendChild(sc);
        };
        var remember = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } };
        var showBanner = function () {
          var old = document.querySelector(".analytics-banner");
          if (old) old.remove();
          var b = document.createElement("div");
          b.className = "analytics-banner";
          b.setAttribute("role", "dialog");
          b.setAttribute("aria-label", "Analytics choice");
          b.innerHTML = '<p>We would like to use anonymous visitor statistics (Google Analytics) to improve this website. Nothing is sent unless you accept. See our <a href="privacy.html">Privacy Notice</a>.</p>' +
            '<button type="button" class="btn btn-forest btn-sm" data-a="yes">Accept</button><button type="button" class="btn btn-outline-forest btn-sm" data-a="no">Decline</button>';
          b.addEventListener("click", function (e) {
            var a = e.target && e.target.getAttribute("data-a");
            if (!a) return;
            remember(a === "yes" ? "granted" : "denied");
            if (a === "yes") loadAnalytics();
            b.remove();
          });
          document.body.appendChild(b);
        };

        if (choice === "granted") loadAnalytics();
        else if (choice !== "denied") showBanner();

        var fb = document.querySelector(".footer-bottom");
        if (fb) {
          var link = document.createElement("a");
          link.href = "#";
          link.textContent = "Analytics settings";
          link.style.cssText = "color:inherit;text-decoration:underline;margin-left:0.6rem;";
          link.addEventListener("click", function (e) { e.preventDefault(); showBanner(); });
          fb.firstElementChild && fb.firstElementChild.appendChild(link);
        }
      }

      var slot = document.getElementById("school-map");
      if (slot && cfg.map_embed_url && /^https:\/\//.test(cfg.map_embed_url)) {
        slot.innerHTML = "";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-forest";
        btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Show map';
        var note = document.createElement("p");
        note.style.cssText = "color:var(--ink-soft);font-size:0.85rem;max-width:420px;text-align:center;padding:0 1rem;";
        note.textContent = "The map is provided by Google and loads only when you press the button.";
        slot.appendChild(btn);
        slot.appendChild(note);
        if (cfg.directions_url && /^https:\/\//.test(cfg.directions_url)) {
          var dir = document.createElement("a");
          dir.href = cfg.directions_url; dir.target = "_blank"; dir.rel = "noopener";
          dir.className = "btn btn-outline-forest btn-sm";
          dir.textContent = "Get directions";
          slot.appendChild(dir);
        }
        btn.addEventListener("click", function () {
          var f = document.createElement("iframe");
          f.src = cfg.map_embed_url; f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade";
          f.title = "Map showing Brookview Ridge Schools"; f.allowFullscreen = true;
          slot.style.display = "block"; slot.style.padding = "0";
          slot.innerHTML = ""; slot.appendChild(f);
        });
      }

      document.querySelectorAll("[data-privacy-version]").forEach(function (el) { if (cfg.privacy_version) el.textContent = cfg.privacy_version; });
    });

    /* ---- News & Events live feed: search + pagination ------------------------------ */
    /* Replaces the placeholder cards on news-events.html with real published posts from
       API_BASE + "/news.php", when there are any. If the first fetch fails or no posts are
       published yet, the existing static placeholder content is left exactly as-is — nothing
       is removed, and the search box / pagination stay hidden, unless real posts are ready. */
    var newsFeed = document.querySelector("[data-news-feed]");
    if (newsFeed) {
      var newsCategoryLabels = {
        school_activities: "School Activities",
        parent_updates: "Parent Updates",
        events: "Events",
        learning_moments: "Learning Moments",
        announcements: "Announcements",
        celebrations: "Celebrations",
      };
      var newsSearchForm = document.querySelector("[data-news-search]");
      var newsPaginationEl = document.querySelector("[data-news-pagination]");
      var newsState = { page: 1, q: "" };
      var newsFirstLoad = true;

      function renderNewsPagination(pagination) {
        if (!newsPaginationEl) return;
        if (!pagination || pagination.total_pages <= 1) { newsPaginationEl.innerHTML = ""; return; }
        var html = "";
        for (var p = 1; p <= pagination.total_pages; p++) {
          html += '<button type="button" class="news-page-btn' + (p === pagination.page ? " active" : "") + '" data-news-page="' + p + '">' + p + "</button>";
        }
        newsPaginationEl.innerHTML = html;
      }

      function loadNews(page, q) {
        newsState.page = page;
        newsState.q = q;
        var url = API_BASE + "/news.php?page=" + encodeURIComponent(page) + "&per_page=9";
        if (q) url += "&q=" + encodeURIComponent(q);
        fetch(url)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data || !data.ok) return;

            if (newsFirstLoad) {
              if (!data.posts || !data.posts.length) return; // nothing published at all: keep the static fallback untouched
              newsFirstLoad = false;
              document.querySelectorAll("[data-news-placeholder]").forEach(function (el) { el.style.display = "none"; });
              if (newsSearchForm) newsSearchForm.style.display = "flex";
            }

            newsFeed.innerHTML = "";
            if (!data.posts || !data.posts.length) {
              newsFeed.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft);">No posts match your search.</p>';
              renderNewsPagination(null);
              return;
            }

            data.posts.forEach(function (post) {
              var card = document.createElement("a");
              card.className = "news-card";
              card.href = "news-article.html?slug=" + encodeURIComponent(post.slug);
              var mediaHtml = post.photo_url
                ? '<img src="' + post.photo_url + '" alt="" loading="lazy">'
                : '<div class="photo-placeholder"><i class="fa-solid fa-camera"></i></div>';
              card.innerHTML =
                '<div class="news-media">' + mediaHtml +
                '<span class="news-tag">' + (newsCategoryLabels[post.category] || post.category) + '</span></div>' +
                '<div style="padding:1.5rem;">' +
                '<span class="news-date"><i class="fa-regular fa-calendar"></i> ' + newsFormatDate(post.published_at) + '</span>' +
                '<h4 style="margin-top:0.5rem;">' + escapeHtml(post.title) + '</h4>' +
                '<p style="color:var(--ink-soft);font-size:0.92rem;">' + escapeHtml(post.excerpt) + '</p></div>';
              newsFeed.appendChild(card);
            });

            renderNewsPagination(data.pagination);
          })
          .catch(function () {
            /* Silently keep whatever was already shown — nothing to do here. */
          });
      }

      if (newsSearchForm) {
        newsSearchForm.addEventListener("submit", function (e) {
          e.preventDefault();
          var q = (new FormData(newsSearchForm).get("q") || "").toString().trim();
          loadNews(1, q);
        });
      }
      if (newsPaginationEl) {
        newsPaginationEl.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-news-page]");
          if (!btn) return;
          loadNews(parseInt(btn.getAttribute("data-news-page"), 10) || 1, newsState.q);
        });
      }

      loadNews(1, "");
    }

    /* ---- News & Events: single article page (news-article.html) -------------------- */
    /* Reads ?slug= from the URL and renders the full post, with related posts and
       prev/next navigation, from API_BASE + "/news.php?slug=...". */
    var articleWrap = document.querySelector("[data-article-body-wrap]");
    if (articleWrap) {
      var articleCategoryLabels = {
        school_activities: "School Activities",
        parent_updates: "Parent Updates",
        events: "Events",
        learning_moments: "Learning Moments",
        announcements: "Announcements",
        celebrations: "Celebrations",
      };
      var slug = new URLSearchParams(window.location.search).get("slug") || "";
      var notFoundEl = document.querySelector("[data-article-notfound]");
      var titleEl = document.querySelector("[data-article-title]");
      var dateEl = document.querySelector("[data-article-date]");
      var mediaEl = document.querySelector("[data-article-media]");
      var tagEl = document.querySelector("[data-article-tag]");
      var contentEl = document.querySelector("[data-article-content]");
      var navEl = document.querySelector("[data-article-navlinks]");
      var relatedSection = document.querySelector("[data-article-related-section]");
      var relatedEl = document.querySelector("[data-article-related]");

      function showArticleNotFound() {
        if (titleEl) titleEl.textContent = "Post Not Found";
        if (notFoundEl) notFoundEl.style.display = "block";
      }

      function relatedCardHtml(post) {
        var mediaHtml = post.photo_url
          ? '<img src="' + post.photo_url + '" alt="" loading="lazy">'
          : '<div class="photo-placeholder"><i class="fa-solid fa-camera"></i></div>';
        return '<a class="news-card" href="news-article.html?slug=' + encodeURIComponent(post.slug) + '">' +
          '<div class="news-media">' + mediaHtml +
          '<span class="news-tag">' + (articleCategoryLabels[post.category] || post.category) + '</span></div>' +
          '<div style="padding:1.5rem;">' +
          '<span class="news-date"><i class="fa-regular fa-calendar"></i> ' + newsFormatDate(post.published_at) + '</span>' +
          '<h4 style="margin-top:0.5rem;">' + escapeHtml(post.title) + '</h4></div></a>';
      }

      function navLinkHtml(post, label, align) {
        if (!post) return '<span></span>';
        return '<a href="news-article.html?slug=' + encodeURIComponent(post.slug) + '" style="max-width:48%;text-align:' + align + ';text-decoration:none;color:var(--forest-dark);">' +
          '<span style="display:block;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-soft);">' + label + '</span>' +
          '<strong>' + escapeHtml(post.title) + '</strong></a>';
      }

      if (!slug) {
        showArticleNotFound();
      } else {
        fetch(API_BASE + "/news.php?slug=" + encodeURIComponent(slug))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data || !data.ok || !data.post) { showArticleNotFound(); return; }
            var post = data.post;
            document.title = post.title + " | Brookview Ridge Schools";
            if (titleEl) titleEl.textContent = post.title;
            if (dateEl) dateEl.textContent = newsFormatDate(post.published_at);
            if (tagEl) tagEl.textContent = articleCategoryLabels[post.category] || post.category;
            if (contentEl) contentEl.innerHTML = post.body;
            if (mediaEl && post.photo_url) {
              mediaEl.innerHTML = '<img src="' + post.photo_url + '" alt="" style="width:100%;display:block;">';
              mediaEl.style.display = "block";
            }
            articleWrap.style.display = "block";

            if (navEl) {
              navEl.innerHTML = navLinkHtml(data.prev, "Previous", "left") + navLinkHtml(data.next, "Next", "right");
            }
            if (data.related && data.related.length && relatedEl && relatedSection) {
              relatedEl.innerHTML = data.related.map(relatedCardHtml).join("");
              relatedSection.style.display = "block";
            }
          })
          .catch(function () { showArticleNotFound(); });
      }
    }

  });
})();
