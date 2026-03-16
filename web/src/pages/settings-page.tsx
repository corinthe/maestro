import { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/use-api";
import {
  fetchProjectInfo,
  fetchProjectSoul,
  fetchProjectAgents,
  updateProjectConfig,
} from "../services/api-client";
import type { ProjectInfo, ProjectAgentInfo } from "../types/task";

export function SettingsPage(): React.JSX.Element {
  const { data: project, loading, error, refetch } = useApi<ProjectInfo>(fetchProjectInfo);
  const { data: agents } = useApi<ProjectAgentInfo[]>(fetchProjectAgents);
  const [soul, setSoul] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ defaultBranch: "", maxRetries: 2, timeout: 300 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjectSoul().then(setSoul).catch(() => setSoul(null));
  }, []);

  useEffect(() => {
    if (project) {
      setFormData({
        defaultBranch: project.config.defaultBranch,
        maxRetries: project.config.maxRetries,
        timeout: project.config.timeout,
      });
    }
  }, [project]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateProjectConfig(formData);
      setEditing(false);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }, [formData, refetch]);

  if (loading) return <div className="page-loading">Chargement...</div>;
  if (error) return <div className="page-error">Erreur: {error.message}</div>;
  if (!project) return <div className="page-error">Aucune donnee projet</div>;

  return (
    <div className="settings-page">
      <h1>Configuration du projet</h1>

      <section className="settings-section">
        <h2>Informations generales</h2>
        <div className="settings-grid">
          <div className="settings-field">
            <label>Repertoire de travail</label>
            <span className="settings-value mono">{project.config.workingDir}</span>
          </div>
          <div className="settings-field">
            <label>Remote Git</label>
            <span className="settings-value mono">{project.config.gitRemote ?? "Non detecte"}</span>
          </div>
          <div className="settings-field">
            <label>Orchestrateur</label>
            <span className="settings-value">{project.config.orchestratorAgent}</span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>
          Parametres
          {!editing && (
            <button className="btn btn-small" onClick={() => setEditing(true)}>
              Editer
            </button>
          )}
        </h2>
        {editing ? (
          <div className="settings-form">
            <div className="form-field">
              <label htmlFor="defaultBranch">Branche par defaut</label>
              <input
                id="defaultBranch"
                value={formData.defaultBranch}
                onChange={(e) => setFormData((f) => ({ ...f, defaultBranch: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="maxRetries">Max retries</label>
              <input
                id="maxRetries"
                type="number"
                min={1}
                max={10}
                value={formData.maxRetries}
                onChange={(e) => setFormData((f) => ({ ...f, maxRetries: Number(e.target.value) }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="timeout">Timeout (s)</label>
              <input
                id="timeout"
                type="number"
                min={30}
                max={3600}
                value={formData.timeout}
                onChange={(e) => setFormData((f) => ({ ...f, timeout: Number(e.target.value) }))}
              />
            </div>
            {saveError && <div className="form-error">{saveError}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
              <button className="btn" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-grid">
            <div className="settings-field">
              <label>Branche par defaut</label>
              <span className="settings-value">{project.config.defaultBranch}</span>
            </div>
            <div className="settings-field">
              <label>Max retries</label>
              <span className="settings-value">{project.config.maxRetries}</span>
            </div>
            <div className="settings-field">
              <label>Timeout</label>
              <span className="settings-value">{project.config.timeout}s</span>
            </div>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>
          SOUL.md
          {project.hasSoul ? (
            <span className="badge badge-success">Detecte</span>
          ) : (
            <span className="badge badge-warning">Absent</span>
          )}
        </h2>
        {project.hasSoul ? (
          <>
            <p className="settings-info">
              Le fichier SOUL.md ({project.soulSize} caracteres) est injecte dans chaque prompt d'agent
              pour adapter les reponses au contexte de votre projet.
            </p>
            {soul !== null && (
              <pre className="soul-preview">{soul}</pre>
            )}
          </>
        ) : (
          <p className="settings-warning">
            Aucun fichier SOUL.md detecte dans le repertoire de travail. Maestro fonctionnera,
            mais les resultats seront plus generiques. Creez un fichier SOUL.md a la racine
            du projet cible pour decrire ses conventions, son architecture et ses regles.
          </p>
        )}
      </section>

      {project.sharedContextSize > 0 && (
        <section className="settings-section">
          <h2>Contexte partage</h2>
          <p className="settings-info">
            {project.sharedContextSize} caracteres de contexte partage (agents/shared/) injectes dans chaque prompt.
          </p>
        </section>
      )}

      <section className="settings-section">
        <h2>Agents actifs</h2>
        {agents && agents.length > 0 ? (
          <ul className="agent-list">
            {agents.map((agent) => (
              <li key={agent.name} className="agent-item">
                <strong>{agent.name}</strong>
                <span>{agent.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-info">Aucun agent configure.</p>
        )}
      </section>
    </div>
  );
}
