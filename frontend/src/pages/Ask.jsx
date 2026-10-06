import { useLocation } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { categories, countries } from '../data/sample'

export default function Ask() {
  const location = useLocation() // "Ask a question" on a country page pre-selects that country
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1>Ask the community</h1>
        <p>Good questions get answers faster. Say where you are applying, when you start, and what you have already tried.</p>
      </header>

      <form className="card card-pad stack" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="title">Question</label>
          <input id="title" className="input" maxLength={300} required
            placeholder="How much money do I need to show for a UK student visa?" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="country">Destination</label>
            <select id="country" className="select" required defaultValue={location.state?.country || 'uk'}>
              {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Topic</label>
            <select id="category" className="select" defaultValue="">
              <option value="" disabled>Choose a topic</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="body">Details</label>
          <textarea id="body" className="textarea" placeholder="Course, university, intake, budget, anything that helps someone answer." />
          <span className="hint">Do not share passport numbers or bank details.</span>
        </div>
        <label className="upload">
          <ImagePlus size={18} />
          <span>Add images <span className="faint">(PNG or JPG, up to 4)</span></span>
          <input type="file" accept="image/png,image/jpeg" multiple className="visually-hidden" />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost">Save draft</button>
          <button className="btn btn-primary">Post question</button>
        </div>
      </form>
    </div>
  )
}
