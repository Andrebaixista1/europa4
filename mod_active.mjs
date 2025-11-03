import fs from 'fs';
const path = 'src/pages/Status.jsx';
let s = fs.readFileSync(path, 'utf8');
// 1) add active in array mapping
s = s.replace(
  "name: item.workflow_name || item.name || item.workflow || item.service || 'Workflow',",
  "name: item.workflow_name || item.name || item.workflow || item.service || 'Workflow',\n              active: item.active === true,"
);
// 2) add active in object mapping
s = s.replace(
  "name: v?.workflow_name || k || 'Workflow',",
  "name: v?.workflow_name || k || 'Workflow',\n              active: v?.active === true,"
);
// 3) fallback row add active
s = s.replace('workflowId: null }', 'workflowId: null, active: null }');
// 4) header insert
s = s.replace(
  "<th style={{minWidth: '220px'}}>Última Execução</th>\n                  <th>Ações</th>",
  "<th style={{minWidth: '220px'}}>Última Execução</th>\n                  <th style={{minWidth: '110px'}}>Ativo</th>\n                  <th>Ações</th>"
);
// 5) body insert before actions after date cell
const dateCell = "<td>{c.at ? formatDateDDMMYYYYHHMM(c.at) : '-'}</td>";
const actionsOpen = "\n                    <td>";
const needle = dateCell + actionsOpen;
const add = `${dateCell}\n                    <td>{c.active === true ? (\n                      <span className=\"text-success d-inline-flex align-items-center gap-1\"><FiCheckCircle /> Ativo</span>\n                    ) : (c.active === false ? (\n                      <span className=\"text-danger d-inline-flex align-items-center gap-1\"><FiXCircle /> Inativo</span>\n                    ) : '-' )}</td>\n                    <td>`;
s = s.replace(needle, add);
fs.writeFileSync(path, s, 'utf8');
console.log('patched');
