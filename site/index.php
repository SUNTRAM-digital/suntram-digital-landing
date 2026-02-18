<?php
// suntram.digital/site
// Returns a machine-readable JSON summary of the marketing site (for AI analysis).

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pretty = isset($_GET['pretty']) && ($_GET['pretty'] === '1' || strtolower((string)$_GET['pretty']) === 'true');

$root = dirname(__DIR__); // .../suntram-digital-landing
$htmlPath = $root . DIRECTORY_SEPARATOR . 'index.html';

if (!is_file($htmlPath)) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'index.html not found',
    'path' => $htmlPath,
  ], $pretty ? JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE : (JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
  exit;
}

$html = file_get_contents($htmlPath);
if ($html === false) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'Failed to read index.html',
  ], $pretty ? JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE : (JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
  exit;
}

libxml_use_internal_errors(true);
$doc = new DOMDocument();
// Ensure UTF-8 parsing even if HTML lacks meta (it has, but keep robust).
$doc->loadHTML('<?xml encoding="utf-8" ?>' . $html);
$xp = new DOMXPath($doc);

$trim = static function (?string $s): string {
  $s = $s ?? '';
  $s = preg_replace('/\s+/u', ' ', $s);
  return trim((string)$s);
};

$attr = static function (DOMNode $n, string $name): string {
  if (!($n instanceof DOMElement)) return '';
  return $n->hasAttribute($name) ? (string)$n->getAttribute($name) : '';
};

$textContent = static function (?DOMNode $n) use ($trim): string {
  if (!$n) return '';
  return $trim($n->textContent);
};

$firstNodeText = static function (DOMNodeList $list) use ($textContent): string {
  return $list->length ? $textContent($list->item(0)) : '';
};

$firstAttr = static function (DOMNodeList $list, string $name) use ($attr): string {
  if (!$list->length) return '';
  $n = $list->item(0);
  return $attr($n, $name);
};

$metaByName = static function (string $name) use ($xp): string {
  $q = sprintf('//meta[translate(@name,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="%s"]/@content', strtolower($name));
  $nodes = $xp->query($q);
  return $nodes && $nodes->length ? (string)$nodes->item(0)->nodeValue : '';
};

$metaByProperty = static function (string $prop) use ($xp): string {
  $q = sprintf('//meta[@property="%s"]/@content', $prop);
  $nodes = $xp->query($q);
  return $nodes && $nodes->length ? (string)$nodes->item(0)->nodeValue : '';
};

$title = $firstNodeText($xp->query('//title'));
$description = $metaByName('description');

// Brand
$brandName = $firstNodeText($xp->query('//*[@class and contains(concat(" ", normalize-space(@class), " "), " brand__word ")]'));
$logoSrc = $firstAttr($xp->query('//img[contains(@class,"brand__logo")]/@src'), '');
if ($logoSrc === '') {
  // fallback: read src attribute directly
  $logoSrc = $firstAttr($xp->query('//img[contains(@class,"brand__logo")]'), 'src');
}

// Navigation links
$navLinks = [];
foreach ($xp->query('//*[@id="nav-links"]//a') as $a) {
  if (!($a instanceof DOMElement)) continue;
  $navLinks[] = [
    'label' => $trim($a->textContent),
    'href' => $a->getAttribute('href'),
  ];
}

// Hero
$heroKicker = $firstNodeText($xp->query('//*[contains(@class,"kicker")][1]'));
$heroH1 = $firstNodeText($xp->query('//h1[1]'));
$heroLead = $firstNodeText($xp->query('//*[contains(@class,"lead")][1]'));
$heroPills = [];
foreach ($xp->query('//*[contains(@class,"hero__trust")]//*[contains(@class,"pill")]') as $p) {
  $heroPills[] = $trim($p->textContent);
}
$heroMetrics = [];
foreach ($xp->query('//*[contains(@class,"metrics")]//*[contains(@class,"metric")]') as $m) {
  $num = '';
  $label = '';
  $numNode = $xp->query('.//*[contains(@class,"metric__num")]', $m);
  if ($numNode && $numNode->length) {
    $el = $numNode->item(0);
    if ($el instanceof DOMElement && $el->hasAttribute('data-count-to')) {
      $num = (string)$el->getAttribute('data-count-to');
    } else {
      $num = $trim($el->textContent);
    }
  }
  $label = $firstNodeText($xp->query('.//*[contains(@class,"metric__label")]', $m));
  if ($num !== '' || $label !== '') {
    $heroMetrics[] = ['value' => $num, 'label' => $label];
  }
}

// Sections outline (top-level)
$sections = [];
foreach ($xp->query('//main//*[@id and (self::section or self::header)]') as $sec) {
  if (!($sec instanceof DOMElement)) continue;
  $id = $sec->getAttribute('id');
  if ($id === '') continue;
  $h2 = $firstNodeText($xp->query('.//h2[1]', $sec));
  $p = $firstNodeText($xp->query('.//p[1]', $sec));
  $sections[] = [
    'id' => $id,
    'title' => $h2,
    'summary' => $p,
  ];
}

// Services
$services = [];
foreach ($xp->query('//article[contains(@class,"service") and @data-service]') as $card) {
  if (!($card instanceof DOMElement)) continue;
  $key = $card->getAttribute('data-service');
  $name = $firstNodeText($xp->query('.//h3[1]', $card));
  $desc = $firstNodeText($xp->query('.//p[1]', $card));
  $items = [];
  foreach ($xp->query('.//ul[contains(@class,"serviceList")]/li', $card) as $li) {
    $items[] = $trim($li->textContent);
  }
  $services[] = [
    'key' => $key,
    'name' => $name,
    'description' => $desc,
    'highlights' => $items,
  ];
}

// AI cards
$ai = [];
foreach ($xp->query('//*[@id="ai"]//*[contains(@class,"aiCard")]') as $card) {
  $h3 = $firstNodeText($xp->query('.//h3[1]', $card));
  $p = $firstNodeText($xp->query('.//p[1]', $card));
  $tags = [];
  foreach ($xp->query('.//*[contains(@class,"aiTags")]/span', $card) as $t) {
    $tags[] = $trim($t->textContent);
  }
  $ai[] = ['name' => $h3, 'description' => $p, 'tags' => $tags];
}

// Process steps
$process = [];
foreach ($xp->query('//*[@id="proceso"]//ol[contains(@class,"steps")]/li') as $li) {
  $num = $firstNodeText($xp->query('.//*[contains(@class,"step__num")][1]', $li));
  $h3 = $firstNodeText($xp->query('.//h3[1]', $li));
  $p = $firstNodeText($xp->query('.//p[1]', $li));
  $process[] = ['step' => $num, 'title' => $h3, 'description' => $p];
}

// Contact
$contactEmail = $firstAttr($xp->query('//*[@id="contacto"]//a[starts-with(@href,"mailto:")]'), 'href');
$contactTel = $firstAttr($xp->query('//*[@id="contacto"]//a[starts-with(@href,"tel:")]'), 'href');

// Footer links
$footerLinks = [];
foreach ($xp->query('//footer//*[contains(@class,"footer__links")]//a') as $a) {
  if (!($a instanceof DOMElement)) continue;
  $footerLinks[] = [
    'label' => $trim($a->textContent),
    'href' => $a->getAttribute('href'),
  ];
}

$out = [
  'ok' => true,
  'generatedAt' => gmdate('c'),
  'site' => [
    'name' => $brandName !== '' ? $brandName : 'SUNTRAM Digital',
    'title' => $title,
    'description' => $description,
    'logo' => $logoSrc !== '' ? $logoSrc : 'assets/logo-suntram.png',
    'language' => 'es',
  ],
  'openGraph' => [
    'title' => $metaByProperty('og:title'),
    'description' => $metaByProperty('og:description'),
    'type' => $metaByProperty('og:type'),
  ],
  'navigation' => $navLinks,
  'hero' => [
    'kicker' => $heroKicker,
    'headline' => $heroH1,
    'lead' => $heroLead,
    'pillars' => $heroPills,
    'metrics' => $heroMetrics,
  ],
  'sections' => $sections,
  'services' => $services,
  'aiSolutions' => $ai,
  'process' => $process,
  'contact' => [
    'email' => $contactEmail,
    'tel' => $contactTel,
  ],
  'footerLinks' => $footerLinks,
  'source' => [
    'indexHtml' => '/index.html',
    'endpoint' => '/site',
    'notes' => 'Auto-generated summary from index.html for AI consumption.',
  ],
];

echo json_encode(
  $out,
  ($pretty ? JSON_PRETTY_PRINT : 0) | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
