/*!
 * Copyright(c) 2014 Jan Blaha (pofider)
 *
 * Orchestrate the OData /$metadata request
 */

/* eslint no-redeclare:0 */

const builder = require("xmlbuilder");

module.exports = function (cfg) {
  return buildMetadata(cfg.model);
};

function buildMetadata(model) {
  const schemas = [];

  for (const schema of model.schemas) {
    const entityTypes = [];
    for (const typeKey in schema.entityTypes) {
      const entityType = {
        "@Name": typeKey,
        Property: [],
        NavigationProperty: [],
      };

      for (const propKey in schema.entityTypes[typeKey]) {
        const property = schema.entityTypes[typeKey][propKey];
        const finalObject = { "@Name": propKey, "@Type": property.type };
        if (Object.prototype.hasOwnProperty.call(property, "nullable")) {
          finalObject["@Nullable"] = property.nullable;
        }

        if (Object.prototype.hasOwnProperty.call(property, "maxlength")) {
          finalObject["@MaxLength"] = property.maxlength;
        }

        // Add annotations if defined
        if (property.annotations) {
          finalObject.Annotation = property.annotations.map((annotation) => ({
            "@Term": annotation.term,
            "@String": annotation.value,
          }));
        }

        if (property.navigation) {
          // Add to NavigationProperty if navigation is true
          entityType.NavigationProperty.push(finalObject);
        } else {
          // Otherwise, add to Property
          entityType.Property.push(finalObject);
        }

        if (property.key) {
          entityType.Key = {
            PropertyRef: {
              "@Name": propKey,
            },
          };
        }
      }

      entityTypes.push(entityType);
    }

    const complexTypes = [];
    for (const typeKey in schema.complexTypes) {
      const complexType = {
        "@Name": typeKey,
        Property: [],
      };

      for (const propKey in schema.complexTypes[typeKey]) {
        const property = schema.complexTypes[typeKey][propKey];
        const propObject = {
          "@Name": propKey,
          "@Type": property.type,
        };

        // Add additional attributes if they exist
        if (Object.prototype.hasOwnProperty.call(property, "nullable")) {
          propObject["@Nullable"] = property.nullable;
        }
        if (Object.prototype.hasOwnProperty.call(property, "maxlength")) {
          propObject["@MaxLength"] = property.maxlength;
        }
        if (Object.prototype.hasOwnProperty.call(property, "precision")) {
          propObject["@Precision"] = property.precision;
        }
        // You can add other attributes such as Scale, etc., similarly

        // Add annotations if defined
        if (property.annotations) {
          propObject.Annotation = property.annotations.map((annotation) => ({
            "@Term": annotation.term,
            "@String": annotation.value,
          }));
        }

        complexType.Property.push(propObject);
      }
      complexTypes.push(complexType);
    }

    // Process EnumTypes
    const enumTypes = [];
    for (const typeKey in schema.enumTypes) {
      const enumType = {
        "@Name": typeKey,
        Member: [],
      };

      for (const memberKey in schema.enumTypes[typeKey]) {
        const member = schema.enumTypes[typeKey][memberKey];
        const memberObject = { "@Name": memberKey };

        // Add annotations to EnumType members if defined
        if (member.annotations) {
          memberObject.Annotation = member.annotations.map((annotation) => ({
            "@Term": annotation.term,
            "@String": annotation.value,
          }));
        }

        enumType.Member.push(memberObject);
      }

      enumTypes.push(enumType);
    }

    const schemaObject = {
      "@xmlns": "http://docs.oasis-open.org/odata/ns/edm",
      "@Namespace": schema.namespace,
      EntityType: entityTypes,
    };

    if (complexTypes.length) {
      schemaObject.ComplexType = complexTypes;
    }

    if (enumTypes.length) {
      schemaObject.EnumType = enumTypes;
    }

    // Add EntityContainer only if there are EntitySets
    if (schema.entitySets && Object.keys(schema.entitySets).length > 0) {
      const container = {
        "@Name": schema.containerName || "DefaultContainer",
        EntitySet: [],
      };

      for (const setKey in schema.entitySets) {
        container.EntitySet.push({
          "@EntityType": schema.entitySets[setKey].entityType,
          "@Name": setKey,
        });
      }

      schemaObject.EntityContainer = container;
    }

    schemas.push(schemaObject);
  }

  const returnObject = {
    "edmx:Edmx": {
      "@xmlns:edmx": "http://docs.oasis-open.org/odata/ns/edmx",
      "@Version": "4.0",
      "edmx:DataServices": {
        Schema: schemas,
      },
    },
  };

  return builder
    .create(returnObject, { standalone: true, encoding: "UTF-8" })
    .end({ pretty: true });
}
