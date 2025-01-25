/* eslint no-redeclare:0 */
function prune (doc, model, type) {
  if (doc instanceof Array) {
    for (const i in doc) {
      prune(doc[i], model, type)
    }
    return
  }

  for (const prop in doc) {
    if (!prop || doc[prop] === undefined || prop.toString().substring(0, 6) === '@odata') {
      continue
    }

    const propDef = type[prop]

    if (!propDef) {
      delete doc[prop]
      continue
    }

    if (propDef.type.indexOf('Collection') === 0) {
      if (propDef.type.indexOf('Collection(Edm') === 0) {
        continue
      }
      let complexTypeName = propDef.type.replace('Collection(' + model.namespace + '.', '')
      complexTypeName = complexTypeName.substring(0, complexTypeName.length - 1)
      const complexType = model.complexTypes[complexTypeName]
      if (!complexType) {
        throw new Error('Complex type ' + complexTypeName + ' was not found.')
      }

      for (const i in doc[prop]) {
        prune(doc[prop][i], model, complexType)
      }
      continue
    }

    if (propDef.type.indexOf('Edm') !== 0) {
      const complexTypeName = propDef.type.replace(model.namespace + '.', '')
      const complexType = model.complexTypes[complexTypeName]
      if (!complexType) {
        throw new Error('Complex type ' + complexTypeName + ' was not found.')
      }
      prune(doc[prop], model, complexType)
    }
  }
}

module.exports = function (model, collection, docs) {
  // Find the schema that contains the entity set
  const schema = model.schemas.find(s => s.entitySets && s.entitySets[collection])

  if (!schema) {
    throw new Error(`EntitySet "${collection}" not found in any schema.`)
  }

  const entitySet = schema.entitySets[collection]

  if (!entitySet) {
    throw new Error(`EntitySet "${collection}" is undefined.`)
  }

  // Get the entity type from the schema
  const entityTypeName = entitySet.entityType.replace(schema.namespace + '.', '')
  const entityType = schema.entityTypes[entityTypeName]

  if (!entityType) {
    throw new Error(`EntityType "${entityTypeName}" not found in schema "${schema.namespace}".`)
  }

  prune(docs, model, entityType)
}
