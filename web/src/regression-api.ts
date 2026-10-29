// Only the explicitly requested regression build includes this entry.
import { api } from './api'
declare global { interface Window { regressionApi: typeof api } }
window.regressionApi = api
