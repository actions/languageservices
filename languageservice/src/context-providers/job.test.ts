import {DescriptionDictionary, isDescriptionDictionary} from "@actions/expressions";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {WorkflowContext} from "../context/workflow-context.js";
import {getJobContext} from "./job.js";

function stringToToken(value: string): StringToken {
  return new StringToken(undefined, undefined, value, undefined);
}

describe("job context", () => {
  it("returns empty context when no job", () => {
    const workflowContext = {} as WorkflowContext;
    const context = getJobContext(workflowContext);

    // When there's no job, context is empty
    expect(context.pairs().length).toBe(0);
  });

  it("returns status and check_run_id when job has no container or services", () => {
    const workflowContext = {job: {}} as WorkflowContext;
    const context = getJobContext(workflowContext);

    expect(context.get("status")).toBeDefined();
    expect(context.get("check_run_id")).toBeDefined();
    expect(context.get("container")).toBeUndefined();
    expect(context.get("services")).toBeUndefined();
  });

  describe("container context", () => {
    it("includes container with id and network when container is defined", () => {
      const containerToken = new MappingToken(undefined, undefined, undefined);
      containerToken.add(stringToToken("image"), stringToToken("node:18"));

      const workflowContext = {
        job: {container: containerToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);
      const container = context.get("container");

      expect(container).toBeDefined();
      if (!container) return;
      expect(isDescriptionDictionary(container)).toBe(true);

      const containerDict = container as DescriptionDictionary;
      expect(containerDict.get("id")).toBeDefined();
      expect(containerDict.get("network")).toBeDefined();
      expect(containerDict.get("ports")).toBeUndefined(); // job container has no ports
    });

    it("container has descriptions", () => {
      const containerToken = new MappingToken(undefined, undefined, undefined);
      containerToken.add(stringToToken("image"), stringToToken("node:18"));

      const workflowContext = {
        job: {container: containerToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);

      const containerDescription = context.getDescription("container");
      expect(containerDescription).toBeDefined();

      const containerDict = context.get("container") as DescriptionDictionary;
      expect(containerDict.getDescription("id")).toBeDefined();
      expect(containerDict.getDescription("network")).toBeDefined();
    });
  });

  describe("services context", () => {
    it("includes services with id, network, and ports", () => {
      const redisToken = new MappingToken(undefined, undefined, undefined);
      redisToken.add(stringToToken("image"), stringToToken("redis:latest"));

      const servicesToken = new MappingToken(undefined, undefined, undefined);
      servicesToken.add(stringToToken("redis"), redisToken);

      const workflowContext = {
        job: {services: servicesToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);
      const services = context.get("services");

      expect(services).toBeDefined();
      if (!services) return;
      expect(isDescriptionDictionary(services)).toBe(true);

      const servicesDict = services as DescriptionDictionary;
      const redis = servicesDict.get("redis");
      expect(redis).toBeDefined();
      if (!redis) return;
      expect(isDescriptionDictionary(redis)).toBe(true);

      const redisDict = redis as DescriptionDictionary;
      expect(redisDict.get("id")).toBeDefined();
      expect(redisDict.get("network")).toBeDefined();
      expect(redisDict.get("ports")).toBeDefined(); // services have ports
    });

    it("parses service ports in host:container format", () => {
      const portsSequence = new SequenceToken(undefined, undefined, undefined);
      portsSequence.add(stringToToken("6379:6379"));
      portsSequence.add(stringToToken("8080:80"));

      const redisToken = new MappingToken(undefined, undefined, undefined);
      redisToken.add(stringToToken("image"), stringToToken("redis:latest"));
      redisToken.add(stringToToken("ports"), portsSequence);

      const servicesToken = new MappingToken(undefined, undefined, undefined);
      servicesToken.add(stringToToken("redis"), redisToken);

      const workflowContext = {
        job: {services: servicesToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);
      const services = context.get("services") as DescriptionDictionary;
      const redis = services.get("redis") as DescriptionDictionary;
      const ports = redis.get("ports") as DescriptionDictionary;

      // Container ports should be the keys (second part of host:container)
      expect(ports.get("6379")).toBeDefined();
      expect(ports.get("80")).toBeDefined();
    });

    it("parses service ports in single port format", () => {
      const portsSequence = new SequenceToken(undefined, undefined, undefined);
      portsSequence.add(stringToToken("6379"));

      const redisToken = new MappingToken(undefined, undefined, undefined);
      redisToken.add(stringToToken("image"), stringToToken("redis:latest"));
      redisToken.add(stringToToken("ports"), portsSequence);

      const servicesToken = new MappingToken(undefined, undefined, undefined);
      servicesToken.add(stringToToken("redis"), redisToken);

      const workflowContext = {
        job: {services: servicesToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);
      const services = context.get("services") as DescriptionDictionary;
      const redis = services.get("redis") as DescriptionDictionary;
      const ports = redis.get("ports") as DescriptionDictionary;

      // Single port format uses the port as the key
      expect(ports.get("6379")).toBeDefined();
    });

    it("services have descriptions", () => {
      const redisToken = new MappingToken(undefined, undefined, undefined);
      redisToken.add(stringToToken("image"), stringToToken("redis:latest"));

      const servicesToken = new MappingToken(undefined, undefined, undefined);
      servicesToken.add(stringToToken("redis"), redisToken);

      const workflowContext = {
        job: {services: servicesToken}
      } as unknown as WorkflowContext;

      const context = getJobContext(workflowContext);

      const servicesDescription = context.getDescription("services");
      expect(servicesDescription).toBeDefined();

      const services = context.get("services") as DescriptionDictionary;
      const redis = services.get("redis") as DescriptionDictionary;
      expect(redis.getDescription("id")).toBeDefined();
      expect(redis.getDescription("network")).toBeDefined();
      expect(redis.getDescription("ports")).toBeDefined();
    });
  });
});
