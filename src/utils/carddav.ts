import { ContactRecord } from "../types.js";
import { buildContactVCard, getVCardEtag } from "./vcard.js";

const DAV_NAMESPACE = "DAV:";
const CARDDAV_NAMESPACE = "urn:ietf:params:xml:ns:carddav";
const CALENDAR_SERVER_NAMESPACE = "http://calendarserver.org/ns/";

export interface CardDavPaths {
  rootPath: string;
  principalPath: string;
  addressBookHomePath: string;
  addressBookPath: string;
}

interface PropfindResponse {
  href: string;
  props: string[];
}

function trimTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeHrefPath(href: string, baseUrl?: string): string {
  try {
    const resolved = new URL(href, baseUrl || "https://example.invalid");
    return resolved.pathname
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .join("/");
  } catch {
    return href
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .join("/");
  }
}

function buildContactHref(paths: CardDavPaths, contact: ContactRecord): string {
  return `${paths.addressBookPath}${encodeURIComponent(contact.uid)}.vcf`;
}

export function buildCardDavPaths(pathPrefix: string): CardDavPaths {
  const rootPath = `${trimTrailingSlash(pathPrefix)}/`;

  return {
    rootPath,
    principalPath: `${rootPath}principals/admin/`,
    addressBookHomePath: `${rootPath}addressbooks/`,
    addressBookPath: `${rootPath}addressbooks/employees/`
  };
}

function isCollectionPath(requestPath: string, targetPath: string): boolean {
  return trimTrailingSlash(requestPath) === trimTrailingSlash(targetPath);
}

export function buildAddressBookSyncToken(baseUrl: string, addressBookPath: string, lastSyncedAt: string | null): string {
  const base = trimTrailingSlash(baseUrl);
  const encoded = encodeURIComponent(lastSyncedAt || "empty");
  return `${base}${addressBookPath}sync/${encoded}`;
}

function buildSupportedReportSet(): string {
  return `<D:supported-report-set>
  <D:supported-report><D:report><C:addressbook-query/></D:report></D:supported-report>
  <D:supported-report><D:report><C:addressbook-multiget/></D:report></D:supported-report>
  <D:supported-report><D:report><D:sync-collection/></D:report></D:supported-report>
</D:supported-report-set>`;
}

function buildCurrentUserPrivilegeSet(): string {
  return `<D:current-user-privilege-set>
  <D:privilege><D:read/></D:privilege>
  <D:privilege><D:read-current-user-privilege-set/></D:privilege>
</D:current-user-privilege-set>`;
}

function buildSupportedPrivilegeSet(): string {
  return `<D:supported-privilege-set>
  <D:supported-privilege>
    <D:privilege><D:read/></D:privilege>
    <D:description>Read resource data.</D:description>
  </D:supported-privilege>
  <D:supported-privilege>
    <D:privilege><D:read-current-user-privilege-set/></D:privilege>
    <D:description>Read effective privileges for the current user.</D:description>
  </D:supported-privilege>
</D:supported-privilege-set>`;
}

function buildSupportedAddressData(): string {
  return `<C:supported-address-data>
  <C:address-data-type content-type="text/vcard" version="3.0"/>
  <C:address-data-type content-type="text/vcard" version="4.0"/>
</C:supported-address-data>`;
}

function buildMultistatus(responses: PropfindResponse[], syncToken?: string): string {
  const responseXml = responses
    .map(
      (response) => `<D:response>
  <D:href>${escapeXml(response.href)}</D:href>
  <D:propstat>
    <D:prop>
      ${response.props.join("")}
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`
    )
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="${DAV_NAMESPACE}" xmlns:C="${CARDDAV_NAMESPACE}" xmlns:CS="${CALENDAR_SERVER_NAMESPACE}">
${responseXml}
${syncToken ? `<D:sync-token>${escapeXml(syncToken)}</D:sync-token>` : ""}
</D:multistatus>`;
}

function buildPrincipalResponse(paths: CardDavPaths, username: string): PropfindResponse {
  return {
    href: paths.principalPath,
    props: [
      "<D:resourcetype><D:principal/></D:resourcetype>",
      `<D:displayname>${escapeXml(username)}</D:displayname>`,
      `<D:principal-URL><D:href>${escapeXml(paths.principalPath)}</D:href></D:principal-URL>`,
      `<C:addressbook-home-set><D:href>${escapeXml(paths.addressBookHomePath)}</D:href></C:addressbook-home-set>`,
      buildCurrentUserPrivilegeSet(),
      buildSupportedPrivilegeSet()
    ]
  };
}

function buildAddressBookHomeResponse(paths: CardDavPaths): PropfindResponse {
  return {
    href: paths.addressBookHomePath,
    props: [
      "<D:resourcetype><D:collection/></D:resourcetype>",
      "<D:displayname>Address Books</D:displayname>",
      buildCurrentUserPrivilegeSet(),
      buildSupportedPrivilegeSet()
    ]
  };
}

function buildAddressBookResponse(
  paths: CardDavPaths,
  bookName: string,
  baseUrl: string,
  lastSyncedAt: string | null
): PropfindResponse {
  const syncToken = buildAddressBookSyncToken(baseUrl, paths.addressBookPath, lastSyncedAt);

  return {
    href: paths.addressBookPath,
    props: [
      "<D:resourcetype><D:collection/><C:addressbook/></D:resourcetype>",
      `<D:displayname>${escapeXml(bookName)}</D:displayname>`,
      `<CS:getctag>${escapeXml(lastSyncedAt || "empty")}</CS:getctag>`,
      `<D:sync-token>${escapeXml(syncToken)}</D:sync-token>`,
      buildCurrentUserPrivilegeSet(),
      buildSupportedPrivilegeSet(),
      buildSupportedAddressData(),
      buildSupportedReportSet()
    ]
  };
}

function buildContactResponse(paths: CardDavPaths, contact: ContactRecord): PropfindResponse {
  const href = buildContactHref(paths, contact);
  const vcard = buildContactVCard(contact);

  return {
    href,
    props: [
      "<D:resourcetype/>",
      `<D:displayname>${escapeXml(contact.fullName)}</D:displayname>`,
      `<D:getetag>${escapeXml(getVCardEtag(vcard))}</D:getetag>`,
      "<D:getcontenttype>text/vcard; charset=utf-8</D:getcontenttype>",
      `<D:getcontentlength>${vcard.length}</D:getcontentlength>`,
      buildCurrentUserPrivilegeSet(),
      buildSupportedPrivilegeSet()
    ]
  };
}

export function buildPropfindDocument(params: {
  paths: CardDavPaths;
  requestPath: string;
  depth: string;
  baseUrl: string;
  bookName: string;
  username: string;
  lastSyncedAt: string | null;
  contacts: ContactRecord[];
}): string | null {
  const { paths, requestPath, depth, bookName, username, lastSyncedAt, contacts } = params;
  const syncToken = buildAddressBookSyncToken(params.baseUrl, paths.addressBookPath, lastSyncedAt);
  const depthOne = depth === "1";
  const normalizedRequestPath = normalizeHrefPath(requestPath, params.baseUrl);

  if (isCollectionPath(normalizedRequestPath, paths.rootPath)) {
    const responses: PropfindResponse[] = [
      {
        href: paths.rootPath,
        props: [
          "<D:resourcetype><D:collection/></D:resourcetype>",
          `<D:displayname>${escapeXml(bookName)}</D:displayname>`,
          `<D:current-user-principal><D:href>${escapeXml(paths.principalPath)}</D:href></D:current-user-principal>`,
          `<D:principal-URL><D:href>${escapeXml(paths.principalPath)}</D:href></D:principal-URL>`,
          `<C:addressbook-home-set><D:href>${escapeXml(paths.addressBookHomePath)}</D:href></C:addressbook-home-set>`,
          buildCurrentUserPrivilegeSet(),
          buildSupportedPrivilegeSet(),
          buildSupportedReportSet()
        ]
      }
    ];

    if (depthOne) {
      responses.push(buildPrincipalResponse(paths, username), buildAddressBookHomeResponse(paths));
    }

    return buildMultistatus(responses);
  }

  if (isCollectionPath(normalizedRequestPath, paths.principalPath)) {
    return buildMultistatus([buildPrincipalResponse(paths, username)]);
  }

  if (isCollectionPath(normalizedRequestPath, paths.addressBookHomePath)) {
    const responses = [buildAddressBookHomeResponse(paths)];
    if (depthOne) {
      responses.push(buildAddressBookResponse(paths, bookName, params.baseUrl, lastSyncedAt));
    }

    return buildMultistatus(responses);
  }

  if (isCollectionPath(normalizedRequestPath, paths.addressBookPath)) {
    const responses = [buildAddressBookResponse(paths, bookName, params.baseUrl, lastSyncedAt)];
    if (depthOne) {
      responses.push(...contacts.map((contact) => buildContactResponse(paths, contact)));
    }

    return buildMultistatus(responses, syncToken);
  }

  const contact = contacts.find((candidate) => buildContactHref(paths, candidate) === normalizedRequestPath);
  if (!contact) {
    return null;
  }

  return buildMultistatus([buildContactResponse(paths, contact)]);
}

export function parseCardDavReport(body: string): {
  type: "addressbook-query" | "addressbook-multiget" | "sync-collection" | null;
  hrefs: string[];
} {
  const hrefs = Array.from(body.matchAll(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/gi)).map((match) => match[1]);

  if (/addressbook-multiget/i.test(body)) {
    return { type: "addressbook-multiget", hrefs };
  }

  if (/addressbook-query/i.test(body)) {
    return { type: "addressbook-query", hrefs };
  }

  if (/sync-collection/i.test(body)) {
    return { type: "sync-collection", hrefs };
  }

  return { type: null, hrefs };
}

export function buildReportDocument(params: {
  paths: CardDavPaths;
  reportType: "addressbook-query" | "addressbook-multiget" | "sync-collection";
  requestedHrefs: string[];
  contacts: ContactRecord[];
  baseUrl: string;
  lastSyncedAt: string | null;
}): string {
  const { paths, reportType, requestedHrefs, contacts, baseUrl, lastSyncedAt } = params;
  const normalizedRequestedHrefs =
    requestedHrefs.length > 0
      ? new Set(
          requestedHrefs.map((href) => normalizeHrefPath(href, baseUrl))
        )
      : null;
  const responses: PropfindResponse[] = [];

  for (const contact of contacts) {
    const href = buildContactHref(paths, contact);
    const normalizedHref = normalizeHrefPath(href, baseUrl);

    if (normalizedRequestedHrefs && !normalizedRequestedHrefs.has(normalizedHref)) {
      continue;
    }

    const vcard = buildContactVCard(contact);
    const props = [`<D:getetag>${escapeXml(getVCardEtag(vcard))}</D:getetag>`];

    if (reportType !== "sync-collection") {
      props.push(`<C:address-data content-type="text/vcard" version="4.0">${escapeXml(vcard)}</C:address-data>`);
    }

    responses.push({ href, props });
  }

  return buildMultistatus(
    responses,
    reportType === "sync-collection"
      ? buildAddressBookSyncToken(baseUrl, paths.addressBookPath, lastSyncedAt)
      : undefined
  );
}
