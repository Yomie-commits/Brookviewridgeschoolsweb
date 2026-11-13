<?php
/**
 * Website setup tool (run on your own computer; do NOT upload the tools/ folder).
 *
 *   php tools/site_setup.php --domain=https://www.yourschool.co.ke
 *   php tools/site_setup.php --domain=https://www.yourschool.co.ke --gsc=YOUR_SEARCH_CONSOLE_TOKEN
 *   php tools/site_setup.php --domain=... --dry-run        (shows what would change, writes nothing)
 *   php tools/site_setup.php --status                      (shows the domain currently set)
 *
 * What it does, safely and repeatably:
 *   1. Replaces the placeholder (or the previously set) domain in every page's canonical, Open Graph
 *      and structured-data addresses, so search engines and link previews use your real address.
 *   2. Generates sitemap.xml listing every page.
 *   3. Generates robots.txt: allows the site, keeps crawlers out of the school system (/school-management-system/),
 *      and points to the sitemap. (robots.txt is a request to crawlers, not a security control.)
 *   4. Optionally adds the Google Search Console verification meta tag to every page.
 * It never touches anything outside this website folder.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$placeholder = 'https://brookviewridgeschools.example';
$stateFile = $root . '/.site-domain';

$opts = getopt('', ['domain:', 'gsc:', 'dry-run', 'status', 'help']);
if (isset($opts['help']) || !$opts) {
    echo "Usage: php tools/site_setup.php --domain=https://www.example.com [--gsc=TOKEN] [--dry-run]\n       php tools/site_setup.php --status\n";
    exit(0);
}
$current = is_file($stateFile) ? trim((string) file_get_contents($stateFile)) : $placeholder;
if (isset($opts['status'])) {
    echo "Domain currently set: {$current}" . ($current === $placeholder ? "  (still the placeholder)\n" : "\n");
    exit(0);
}

$dry = isset($opts['dry-run']);
$domain = rtrim((string) ($opts['domain'] ?? ''), '/');
if ($domain === '' || !preg_match('~^https://[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$~i', $domain)) {
    fwrite(STDERR, "Give your real address as --domain=https://www.yourschool.co.ke (https, no path).\n");
    exit(1);
}
if (str_ends_with(strtolower($domain), '.example') || preg_match('~(localhost|\.local$|\.test$|\.invalid$)~i', $domain)) {
    fwrite(STDERR, "That is not a real public domain: {$domain}\n");
    exit(1);
}
$gsc = isset($opts['gsc']) ? (string) $opts['gsc'] : null;
if ($gsc !== null && !preg_match('/^[A-Za-z0-9_\-]{20,100}$/', $gsc)) {
    fwrite(STDERR, "--gsc must be only the content=\"...\" value of the verification tag (20 to 100 letters/numbers).\n");
    exit(1);
}

$pages = glob($root . '/*.html');
sort($pages);
if (!$pages) {
    fwrite(STDERR, "No .html pages found in {$root}\n");
    exit(1);
}

$changed = 0;
foreach ($pages as $page) {
    $html = (string) file_get_contents($page);
    $new = str_replace([$current, $placeholder], $domain, $html);
    if ($gsc !== null) {
        $tag = '<meta name="google-site-verification" content="' . $gsc . '">';
        if (preg_match('~<meta name="google-site-verification"[^>]*>~', $new)) {
            $new = preg_replace('~<meta name="google-site-verification"[^>]*>~', $tag, $new, 1);
        } else {
            $new = preg_replace('~(</title>)~', '$1' . "\n" . $tag, $new, 1);
        }
    }
    if ($new !== $html) {
        $changed++;
        echo ($dry ? '[dry-run] would update ' : 'updated ') . basename($page) . "\n";
        if (!$dry) {
            file_put_contents($page, $new);
        }
    }
}

// sitemap.xml
$urls = [];
foreach ($pages as $page) {
    $name = basename($page);
    $loc = $name === 'index.html' ? $domain . '/' : $domain . '/' . $name;
    $priority = $name === 'index.html' ? '1.0' : ($name === 'privacy.html' ? '0.3' : '0.8');
    $urls[] = "  <url>\n    <loc>" . htmlspecialchars($loc, ENT_XML1) . "</loc>\n    <lastmod>" . date('Y-m-d', filemtime($page)) . "</lastmod>\n    <priority>{$priority}</priority>\n  </url>";
}
$sitemap = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" . implode("\n", $urls) . "\n</urlset>\n";
$robots = "User-agent: *\nAllow: /\nDisallow: /school-management-system/\n\nSitemap: {$domain}/sitemap.xml\n";

echo ($dry ? '[dry-run] would write ' : 'wrote ') . "sitemap.xml (" . count($urls) . " pages) and robots.txt\n";
if (!$dry) {
    file_put_contents($root . '/sitemap.xml', $sitemap);
    file_put_contents($root . '/robots.txt', $robots);
    file_put_contents($stateFile, $domain . "\n");
}
echo "Domain is now {$domain}. {$changed} page(s) " . ($dry ? 'would change' : 'changed') . ".\n";
echo "Next: upload the changed pages, sitemap.xml and robots.txt (not the tools/ folder), then submit {$domain}/sitemap.xml in Google Search Console.\n";
