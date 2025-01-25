/*!
 * Copyright(c) 2014 Jan Blaha (pofider)
 *
 * Orchestrate the OData / request
 */

module.exports = function (cfg) {
  // Collect all entity sets from schemas
  const entitySets = cfg.model.schemas.flatMap(schema =>
    Object.keys(schema.entitySets || {}).map(entitySetName => ({
      kind: 'EntitySet',
      name: entitySetName,
      url: entitySetName
    }))
  )

  return JSON.stringify({
    '@odata.context': `${cfg.serviceUrl}/$metadata`,
    value: entitySets
  })
}
