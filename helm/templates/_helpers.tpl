{{/*
Expand the name of the chart.
*/}}
{{- define "joke-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "joke-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label.
*/}}
{{- define "joke-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "joke-app.labels" -}}
helm.sh/chart: {{ include "joke-app.chart" . }}
{{ include "joke-app.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "joke-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "joke-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend fully qualified name.
*/}}
{{- define "joke-app.backend.fullname" -}}
{{- printf "%s-backend" (include "joke-app.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Frontend fully qualified name.
*/}}
{{- define "joke-app.frontend.fullname" -}}
{{- printf "%s-frontend" (include "joke-app.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Backend selector labels.
*/}}
{{- define "joke-app.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "joke-app.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend selector labels.
*/}}
{{- define "joke-app.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "joke-app.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Name of the CNPG-generated app secret (created automatically by the Cluster resource).
*/}}
{{- define "joke-app.database.appSecret" -}}
{{- printf "%s-app" .Values.database.clusterName }}
{{- end }}

{{/*
Read-write service hostname for the CNPG cluster.
*/}}
{{- define "joke-app.database.rwHost" -}}
{{- printf "%s-rw" .Values.database.clusterName }}
{{- end }}
