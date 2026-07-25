/**
 * Template gallery — Milestone 6B.
 *
 * Lists the fixture-template catalogue from `core/templates/registry.ts`.
 * Implemented templates are creatable; planned templates are shown **locked**
 * with their delivering milestone and cannot create a project — TALON never
 * implies a fixture capability it does not have (Rule 8/11).
 *
 * Presentational only: creation is delegated to `onCreate` (wired to the
 * project store). No engineering math (Rules 2/7).
 */
import { FIXTURE_TEMPLATES, type FixtureTemplateId } from '../core/templates/registry';

interface TemplateGalleryProps {
  /** Called with a template id when the user creates a project from it. */
  onCreate: (id: FixtureTemplateId) => void;
}

export function TemplateGallery({ onCreate }: TemplateGalleryProps) {
  return (
    <div className="template-gallery">
      {FIXTURE_TEMPLATES.map((t) => {
        const implemented = t.status === 'implemented';
        return (
          <div
            key={t.id}
            className={implemented ? 'template-card' : 'template-card locked'}
          >
            <div className="template-card-head">
              <strong>{t.name}</strong>
              {implemented ? (
                <span className="badge-ok">Available</span>
              ) : (
                <span className="badge-locked" aria-label="Locked template">
                  🔒 Planned · {t.milestone}
                </span>
              )}
            </div>
            <p className="note">{t.description}</p>
            <button
              type="button"
              disabled={!implemented}
              aria-disabled={!implemented}
              title={
                implemented
                  ? `Create a new project from ${t.name}`
                  : `${t.name} is planned for ${t.milestone} and cannot be created in this build.`
              }
              onClick={() => implemented && onCreate(t.id)}
            >
              {implemented ? 'Create project' : 'Not available'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
