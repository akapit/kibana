/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import isEqual from 'lodash/lang/isEqual';
import { IndexPatternCreationRegistry, IndexPatternConfig } from 'ui/management/index_pattern_creation';

import { CallOut } from './components/call_out';
import { setHttpClient, getRollupIndices } from '../services/api';

IndexPatternCreationRegistry.register(() => {
  return class RollupIndexPatternConfig extends IndexPatternConfig {
    static key = 'rollup';

    constructor(httpClient) {
      super(httpClient);
      this.type = 'rollup';
      this.name = 'rollup index pattern';
      this.showSystemIndices = false;
      this.allowWildcards = false;

      setHttpClient(httpClient);
      this.rollupIndex = null;
      this.rollupJobs = [];
      this.rollupIndicesCapabilities = {};
      this.rollupIndices = [];
      this.settingUp = this.setRollupIndices();
    }

    async setRollupIndices() {
      this.rollupIndicesCapabilities = await getRollupIndices();
      this.rollupIndices = Object.keys(this.rollupIndicesCapabilities);
    }

    async getIndexPatternCreationOption(urlHandler) {
      await this.settingUp;
      return this.rollupIndices && this.rollupIndices.length ? {
        text: `Rollup index pattern`,
        description: `Can perform limited aggregations against summarized data`,
        onClick: () => {
          urlHandler('/management/kibana/index?type=rollup');
        },
      } : null;
    }

    getIndexPatternCreationQuery = () => {
      return {
        query: {
          exists: {
            field: "_rollup.version"
          }
        },
      };
    };

    illegalCharacters = (characters = []) => {
      return ['*'].concat(characters);
    }

    getIndexTags() {
      return [{
        key: 'rollup',
        name: 'Rollup',
      }];
    }

    checkIndicesForErrors = (indices) => {
      this.rollupIndex = null;
      this.rollupJobs = [];

      if(!indices || !indices.length) {
        return;
      }

      if(indices.length > 1) {
        return ['Index pattern can only match one rollup index'];
      }

      let i = 0;
      let sameCapabilities = true;
      const capabilities = this.rollupIndicesCapabilities[indices[0].name].capabilities;
      const jobs = Object.keys(capabilities);

      if(!jobs.length) {
        return ['This rollup index has no capabilities'];
      }

      if(jobs.length > 1) {
        while(i < jobs.length - 1 && sameCapabilities) {
          sameCapabilities = isEqual(capabilities[jobs[i]].fields, capabilities[jobs[i + 1]].fields);
          i++;
        }

        if(!sameCapabilities) {
          return ['There is more than one configuration for this rollup index'];
        }
      }

      this.rollupIndex = indices[0].name;
      this.rollupJobs = [...jobs];
    }

    getIndexPatternMappings = () => {
      return this.rollupIndex ? {
        type: 'rollup',
        typeMeta: {
          jobs: this.rollupJobs,
          capabilities: this.rollupIndicesCapabilities[this.rollupIndex].capabilities,
        },
      } : {};
    }

    renderPrompt = () => {
      return (
        <CallOut />
      );
    }
  };
});
