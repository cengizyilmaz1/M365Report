import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/app/DataTable";
import { MetricCard } from "@/components/app/MetricCard";
import type { DirectoryObjectRow, GroupReportDetail, UserReportDetail } from "@/lib/types/reporting";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

const directoryObjectColumns: ColumnDef<DirectoryObjectRow>[] = [
  {
    accessorKey: "displayName",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-ink-950">{row.original.displayName}</p>
        <p className="mt-1 text-xs text-ink-500">{row.original.mail}</p>
      </div>
    )
  },
  {
    accessorKey: "objectType",
    header: "Type",
    cell: ({ row }) => <span className="badge badge-neutral">{row.original.objectType}</span>
  },
  { accessorKey: "userPrincipalName", header: "UPN" }
];

export function UserDetailContent({ detail }: { detail: UserReportDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Licenses"
          value={formatNumber(detail.assignedLicenseCount)}
          detail={detail.assignedSkuNames[0] ?? "No assigned licenses"}
          accent={detail.assignedLicenseCount > 0 ? "positive" : "warning"}
        />
        <MetricCard label="Mailbox type" value={detail.mailboxPurpose} detail={detail.mail} />
        <MetricCard label="Manager" value={detail.managerDisplayName} detail={detail.managerUserPrincipalName} />
        <MetricCard
          label="Directory sync"
          value={
            detail.onPremisesSyncEnabled === null
              ? "Unknown"
              : detail.onPremisesSyncEnabled
                ? "Synced"
                : "Cloud only"
          }
          detail={detail.employeeType}
        />
      </div>

      <DetailSection title="Identity">
        <FactGrid
          items={[
            ["Display name", detail.displayName],
            ["User principal name", detail.userPrincipalName],
            ["Primary mail", detail.mail],
            ["User type", detail.userType],
            ["Status", detail.accountEnabled ? "Enabled" : "Disabled"],
            ["Created", formatDateTime(detail.createdDateTime)]
          ]}
        />
      </DetailSection>

      <DetailSection title="Organization">
        <FactGrid
          items={[
            ["Job title", detail.jobTitle],
            ["Department", detail.department],
            ["Company", detail.companyName],
            ["Office", detail.officeLocation],
            ["Usage location", detail.usageLocation],
            ["Preferred language", detail.preferredLanguage]
          ]}
        />
      </DetailSection>

      <DetailSection title="Profile">
        <FactGrid
          items={[
            ["Given name", detail.givenName],
            ["Surname", detail.surname],
            ["City", detail.city],
            ["State", detail.state],
            ["Country", detail.country],
            ["Employee ID", detail.employeeId]
          ]}
        />
      </DetailSection>

      <DetailSection title="Contact">
        <FactGrid
          items={[
            ["Mobile phone", detail.mobilePhone],
            ["Business phones", detail.businessPhones.join(", ")],
            ["Manager", detail.managerDisplayName],
            ["Manager UPN", detail.managerUserPrincipalName]
          ]}
        />
      </DetailSection>

      <DetailSection title="Mailbox">
        <div className="grid gap-4 xl:grid-cols-2">
          <FactGrid
            items={[
              ["Purpose", detail.mailboxPurpose],
              ["Time zone", detail.mailboxTimeZone],
              ["Language", detail.mailboxLanguage],
              ["Automatic replies", detail.automaticRepliesStatus],
              ["Delegate delivery", detail.delegateMeetingMessageDelivery]
            ]}
          />
          <div className="space-y-3 rounded-2xl border border-ink-900/6 bg-white p-4">
            <DetailStatus title="Forwarding status" value={detail.forwarding.value} note={detail.forwarding.note} />
            <DetailStatus title="Mailbox quota" value={detail.mailboxQuota.value} note={detail.mailboxQuota.note} />
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Licenses">
        <div className="rounded-2xl border border-ink-900/6 bg-white p-4">
          {detail.assignedSkuNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detail.assignedSkuNames.map((skuName) => (
                <span key={skuName} className="badge badge-sky">
                  {skuName}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-600">No licenses assigned.</p>
          )}
        </div>
      </DetailSection>

      {detail.notes.length > 0 && (
        <DetailSection title="Collection notes">
          <NotesBanner notes={detail.notes} compact />
        </DetailSection>
      )}
    </div>
  );
}

export function GroupDetailContent({ detail }: { detail: GroupReportDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Members" value={formatNumber(detail.memberCount)} detail="Direct members returned by Microsoft Graph" />
        <MetricCard label="Owners" value={formatNumber(detail.ownerCount)} detail="Direct owners returned by Microsoft Graph" accent="positive" />
        <MetricCard label="Visibility" value={detail.visibility} detail={detail.mail} />
        <MetricCard label="Role assignable" value={detail.isAssignableToRole ? "Yes" : "No"} detail={detail.groupType} accent={detail.isAssignableToRole ? "warning" : "default"} />
      </div>

      <DetailSection title="Summary">
        <FactGrid
          items={[
            ["Group type", detail.groupType],
            ["Mail", detail.mail],
            ["Mail nickname", detail.mailNickname],
            ["Visibility", detail.visibility],
            ["Created", formatDateTime(detail.createdDateTime)],
            ["Description", detail.description]
          ]}
        />
      </DetailSection>

      <DetailSection title="Membership settings">
        <FactGrid
          items={[
            ["Mail enabled", detail.mailEnabled ? "Yes" : "No"],
            ["Security enabled", detail.securityEnabled ? "Yes" : "No"],
            ["Dynamic rule", detail.membershipRule],
            ["Rule processing", detail.membershipRuleProcessingState]
          ]}
        />
      </DetailSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <DetailSection title="Owners">
          <DataTable data={detail.owners} columns={directoryObjectColumns} searchPlaceholder="Filter owners..." />
        </DetailSection>
        <DetailSection title="Members">
          <DataTable data={detail.members} columns={directoryObjectColumns} searchPlaceholder="Filter members..." />
        </DetailSection>
      </div>

      {detail.notes.length > 0 && (
        <DetailSection title="Collection notes">
          <NotesBanner notes={detail.notes} compact />
        </DetailSection>
      )}
    </div>
  );
}

export function NotesBanner({ notes, compact = false }: { notes: string[]; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-sky-500/15 bg-sky-500/6 px-4 py-3 text-sm text-ink-700 ${compact ? "" : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-sky-500">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <ul className="space-y-0.5">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

export function LoadingDetail() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-ink-900/6 bg-white p-5">
          <div className="mb-3 h-3 w-16 rounded bg-ink-900/8" />
          <div className="mb-2 h-6 w-20 rounded bg-ink-900/8" />
          <div className="h-3 w-28 rounded bg-ink-900/6" />
        </div>
      ))}
    </div>
  );
}

export function InlineError({ note }: { note: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/15 bg-rose-500/8 px-4 py-3 text-sm text-ink-800">
      {note}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-ink-500">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FactGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={`${label}-${value}`} className="rounded-2xl border border-ink-900/6 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">{label}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-ink-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function DetailStatus({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">{title}</p>
      <p className="mt-2 text-sm font-semibold text-ink-950">{value}</p>
      {note && <p className="mt-2 text-sm leading-6 text-ink-600">{note}</p>}
    </div>
  );
}
